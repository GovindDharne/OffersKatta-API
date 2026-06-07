import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { forwardRef, Inject } from '@nestjs/common';
import { Prisma, PushJobStatus, SubscriptionStatus, UserRole, type PushJob } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { BrandsService } from '../brands/brands.service';
import { FirebaseService } from '../firebase/firebase.service';
import { TerritoryScopeService } from '../territories/territory-scope.service';
import { PushAudience } from './dto/push.dto';
import { PushQueueService } from './push.queue';

/// Per-customer / per-day caps. Tweak via env in a future iteration; the
/// values are sensible defaults for a deals app — frequent enough that the
/// network feels alive, rare enough not to be spammy.
const CAP_PER_BRAND_PER_DAY = 3;
const CAP_PER_DAY_TOTAL = 10;

export interface NotifyResult {
  jobId: string;
  status: PushJobStatus;
  planned: number;   // customers in radius matching the offer scope
  capped: number;    // dropped due to frequency cap
  deferred: number;  // skipped because customer is in quiet hours
  sent: number;      // accepted by FCM (or stub-logged in dev)
  failed: number;    // FCM rejected the token (dead/unregistered/invalid)
  errorMessage?: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly brands: BrandsService,
    private readonly firebase: FirebaseService,
    private readonly scope: TerritoryScopeService,
    @Inject(forwardRef(() => PushQueueService))
    private readonly queue: PushQueueService,
  ) {}

  /// Enqueue a "notify nearby customers" job for one offer.
  ///
  /// Auth: only the offer's brand owner or SUPER_ADMIN may trigger.
  /// Returns immediately with a QUEUED PushJob. A BullMQ worker (in-process
  /// by default — see PushQueueService) picks it up and calls processJob().
  /// Sellers poll GET /push/jobs/:id to see counters fill in.
  async notifyOffer(args: {
    offerId: string;
    radiusKm: number;
    triggeredById: string;
    triggeredByRole: UserRole;
    audience?: PushAudience;
  }): Promise<NotifyResult> {
    if (args.radiusKm < 1 || args.radiusKm > 100) {
      throw new BadRequestException('radiusKm must be between 1 and 100');
    }
    const audience = args.audience ?? PushAudience.BOTH;

    const offer = await this.prisma.offer.findUnique({
      where: { id: args.offerId },
      include: {
        branch: { select: { id: true, latitude: true, longitude: true, brand: { select: { id: true, ownerId: true } } } },
        branches: { select: { branchId: true } },
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    const isAdmin = args.triggeredByRole === UserRole.SUPER_ADMIN;
    const isOwner = offer.branch.brand?.ownerId === args.triggeredById;
    if (!isAdmin && !isOwner) {
      // Regional/zone managers may notify for offers on branches in their
      // territory; assertBranchInScope throws Forbidden otherwise.
      if (this.scope.isTerritoryRole(args.triggeredByRole)) {
        await this.scope.assertBranchInScope(offer.branch.id, args.triggeredById, args.triggeredByRole);
      } else {
        throw new ForbiddenException('Only the brand owner can notify customers about this offer');
      }
    }
    const brandId = offer.branch.brand!.id;

    // Pick the priority based on the brand's subscription plan — paying brands
    // jump the queue ahead of free-tier ones during peak times.
    const priority = await this.priorityForBrand(brandId);

    // Audience is stashed in errorMessage temporarily so the worker can re-read
    // it (we don't have a per-job metadata column; adding one would be cleaner
    // but this avoids another migration for one string).
    // Better: serialise into a dedicated `payload` JSON. Keep simple for now.
    const job = await this.prisma.pushJob.create({
      data: {
        offerId: offer.id,
        brandId,
        triggeredById: args.triggeredById,
        radiusKm: args.radiusKm,
        status: PushJobStatus.QUEUED,
        priority,
        errorMessage: `audience=${audience}`, // re-read by processJob
      },
    });

    await this.queue.enqueue(job.id, priority);
    return {
      jobId: job.id,
      status: PushJobStatus.QUEUED,
      planned: 0, capped: 0, deferred: 0, sent: 0, failed: 0,
    };
  }

  /// Worker entry-point. Re-fetches the job row + offer, recomputes recipients,
  /// applies caps + quiet hours, delivers, and writes counters back.
  /// Idempotent on partial failure (job stays PROCESSING; BullMQ retry will
  /// re-enter). Called by PushQueueService's Worker.
  async processJob(pushJobId: string): Promise<void> {
    const job = await this.prisma.pushJob.findUnique({ where: { id: pushJobId } });
    if (!job) throw new NotFoundException('Push job not found');
    if (job.status === PushJobStatus.COMPLETED) return; // idempotent
    const audience = parseAudience(job.errorMessage) ?? PushAudience.BOTH;
    const offer = await this.prisma.offer.findUnique({
      where: { id: job.offerId },
      include: {
        branch: { select: { id: true, latitude: true, longitude: true, brand: { select: { id: true } } } },
        branches: { select: { branchId: true } },
      },
    });
    if (!offer) throw new NotFoundException('Offer for push job no longer exists');
    await this.prisma.pushJob.update({
      where: { id: job.id },
      data: { status: PushJobStatus.PROCESSING, startedAt: new Date(), errorMessage: null },
    });

    const brandId = offer.branch.brand!.id;
    const radiusKm = job.radiusKm;

    try {
      // Compose the recipient set from each enabled audience source and
      // dedup by userId so the same person never gets two pushes for the
      // same offer even if they're both nearby and a follower.
      const byUser = new Map<string, { userId: string; fcmTokens: Set<string>; distanceKm: number }>();

      if (audience === PushAudience.NEARBY || audience === PushAudience.BOTH) {
        const reachable = await this.resolveReachableBranches(offer);
        if (reachable.length > 0) {
          for (const r of await this.resolveRecipients(reachable, radiusKm)) {
            const existing = byUser.get(r.userId);
            if (existing) {
              for (const t of r.fcmTokens) existing.fcmTokens.add(t);
              if (r.distanceKm < existing.distanceKm) existing.distanceKm = r.distanceKm;
            } else {
              byUser.set(r.userId, { userId: r.userId, fcmTokens: new Set(r.fcmTokens), distanceKm: r.distanceKm });
            }
          }
        }
      }

      if (audience === PushAudience.FOLLOWERS || audience === PushAudience.BOTH) {
        for (const f of await this.brands.followersForPush(brandId)) {
          const existing = byUser.get(f.userId);
          if (existing) {
            for (const t of f.fcmTokens) existing.fcmTokens.add(t);
          } else {
            byUser.set(f.userId, {
              userId: f.userId,
              fcmTokens: new Set(f.fcmTokens),
              distanceKm: Infinity,
            });
          }
        }
      }

      const recipients = Array.from(byUser.values()).map((r) => ({
        userId: r.userId,
        fcmTokens: Array.from(r.fcmTokens),
        distanceKm: Number.isFinite(r.distanceKm) ? r.distanceKm : -1,
      }));

      if (recipients.length === 0) {
        await this.complete(job.id, { planned: 0, capped: 0, deferred: 0, sent: 0, failed: 0 });
        return;
      }
      // Pull quiet-hour preferences for all recipients in one query.
      const quietPrefs = await this.prisma.customerProfile.findMany({
        where: { userId: { in: recipients.map((r) => r.userId) } },
        select: { userId: true, quietHoursEnabled: true },
      });
      const quietMap = new Map(quietPrefs.map((p) => [p.userId, p.quietHoursEnabled]));
      const inQuietHoursNow = isInQuietHours();

      let capped = 0;
      let deferred = 0;
      let sent = 0;
      let failed = 0;

      const today = yyyymmdd(new Date());
      for (const r of recipients) {
        // Quiet-hour skip — the customer's local night. Counted as `deferred`
        // (intentionally not re-scheduled — chain offers are typically
        // time-of-day relevant, so silently dropping is preferable to
        // delivering at 11am tomorrow).
        if (inQuietHoursNow && (quietMap.get(r.userId) ?? true)) {
          deferred++;
          continue;
        }
        const ok = await this.consumeCap(r.userId, brandId, today);
        if (!ok) { capped++; continue; }
        const { ok: deliveredOk, failedTokens } = await this.deliver(r, offer);
        if (deliveredOk) sent++;
        failed += failedTokens;
      }

      await this.complete(job.id, { planned: recipients.length, capped, deferred, sent, failed });
    } catch (e) {
      const msg = (e as Error).message;
      await this.prisma.pushJob.update({
        where: { id: job.id },
        data: { status: PushJobStatus.FAILED, errorMessage: msg, finishedAt: new Date() },
      });
      throw e;
    }
  }

  /// BullMQ priority for the brand. Lower = sooner. Reads the brand's active
  /// subscription; falls back to 10 (lowest priority) for free/unsubscribed.
  private async priorityForBrand(brandId: string): Promise<number> {
    const sub = await this.prisma.subscription.findUnique({
      where: { brandId },
      select: { plan: true, status: true, endDate: true },
    });
    const active = sub && sub.status === SubscriptionStatus.ACTIVE
      && (!sub.endDate || sub.endDate > new Date());
    if (!active) return 10;
    switch (sub.plan) {
      case 'ENTERPRISE': return 0; // top priority — contracted tier
      case 'FEATURED':   return 1;
      case 'PREMIUM':    return 5;
      default:           return 10;
    }
  }

  async listJobs(brandIds: string[], limit = 50) {
    return this.prisma.pushJob.findMany({
      where: brandIds.length ? { brandId: { in: brandIds } } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { offer: { select: { id: true, title: true } } },
    });
  }

  async getJob(id: string, requestingUserId: string, requestingRole: UserRole): Promise<PushJob> {
    const job = await this.prisma.pushJob.findUnique({
      where: { id },
      include: { offer: { include: { branch: { select: { brand: { select: { ownerId: true } } } } } } },
    });
    if (!job) throw new NotFoundException('Push job not found');
    const isAdmin = requestingRole === UserRole.SUPER_ADMIN;
    const isOwner = (job as unknown as { offer: { branch: { brand: { ownerId: string } } } }).offer.branch.brand.ownerId === requestingUserId;
    if (!isAdmin && !isOwner) throw new ForbiddenException('Not your push job');
    return job;
  }

  // ─── Internal helpers ──────────────────────────────────────

  /// Resolve which branches the offer reaches based on its scope. Returns the
  /// minimal fields needed for the per-branch radius search (id, lat, lng).
  private async resolveReachableBranches(offer: {
    id: string; scope: string;
    branchId: string; branches: Array<{ branchId: string }>;
    scopeCity: string | null; scopeTags: string[];
    branch: { brand?: { id: string } | null };
  }) {
    const brandId = offer.branch.brand?.id;
    if (!brandId) return [];

    if (offer.scope === 'BRANCH') {
      const ids = [offer.branchId, ...offer.branches.map((b) => b.branchId)];
      return this.prisma.businessBranch.findMany({
        where: { id: { in: ids }, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, latitude: true, longitude: true },
      });
    }
    if (offer.scope === 'BRAND') {
      return this.prisma.businessBranch.findMany({
        where: { brandId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, latitude: true, longitude: true },
      });
    }
    if (offer.scope === 'CITY' && offer.scopeCity) {
      return this.prisma.businessBranch.findMany({
        where: {
          brandId, deletedAt: null, status: 'ACTIVE',
          city: { equals: offer.scopeCity, mode: 'insensitive' },
        },
        select: { id: true, latitude: true, longitude: true },
      });
    }
    if (offer.scope === 'TAGS' && offer.scopeTags.length > 0) {
      return this.prisma.businessBranch.findMany({
        where: {
          brandId, deletedAt: null, status: 'ACTIVE',
          tags: { hasSome: offer.scopeTags },
        },
        select: { id: true, latitude: true, longitude: true },
      });
    }
    return [];
  }

  /// For each reachable branch, find customers in radius. Dedup by userId
  /// (one row per customer with all their fcmTokens collapsed).
  ///
  /// PostGIS does all the heavy lifting: ST_DWithin uses the GIST index on
  /// each branch position to prune candidates, MIN(ST_Distance) finds each
  /// customer's closest branch, and a HAVING clause enforces the customer's
  /// personal notificationRadiusKm. One round-trip replaces a bounding-box
  /// query + O(branches × candidates) JS loop.
  private async resolveRecipients(
    branches: Array<{ id: string; latitude: number; longitude: number }>,
    radiusKm: number,
  ): Promise<Array<{ userId: string; fcmTokens: string[]; distanceKm: number }>> {
    if (branches.length === 0) return [];
    const branchIds = branches.map((b) => b.id);
    const radiusMeters = radiusKm * 1000;

    interface Row {
      userId: string;
      fcmTokens: string[];
      distanceKm: number;
    }
    // Only TABLE names are snake_cased via @@map — COLUMNS keep camelCase,
    // so they're double-quoted. Table aliases (u/cp/t) stay bare.
    const rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
      WITH targets AS (
        SELECT "id", "geog"
        FROM "business_branches"
        WHERE "id" = ANY(${branchIds}::uuid[]) AND "geog" IS NOT NULL
      )
      SELECT
        u."id"                          AS "userId",
        cp."fcmTokens"                  AS "fcmTokens",
        MIN(ST_Distance(u."geog", t."geog")) / 1000.0 AS "distanceKm"
      FROM "users" u
      JOIN "customer_profiles" cp ON cp."userId" = u."id"
      CROSS JOIN targets t
      WHERE u."role"           = 'CUSTOMER'
        AND u."isActive"       = true
        AND u."deletedAt"      IS NULL
        AND u."geog"           IS NOT NULL
        AND cp."phoneVerified" = true
        AND cp."notifyEnabled" = true
        AND array_length(cp."fcmTokens", 1) > 0
        AND ST_DWithin(u."geog", t."geog", ${radiusMeters})
      GROUP BY u."id", cp."fcmTokens", cp."notificationRadiusKm"
      HAVING MIN(ST_Distance(u."geog", t."geog")) / 1000.0 <= cp."notificationRadiusKm"
      LIMIT 10000
    `);

    return rows.map((r) => ({
      userId: r.userId,
      fcmTokens: r.fcmTokens ?? [],
      distanceKm: Number(r.distanceKm),
    }));
  }

  /// Atomically increment the per-brand-per-day and per-day-total counters
  /// in Redis. Returns true if both caps allow this push, false otherwise.
  /// Either counter being over its cap drops the recipient.
  private async consumeCap(userId: string, brandId: string, yyyymmdd: string): Promise<boolean> {
    const perBrandKey = `push:cap:b:${userId}:${brandId}:${yyyymmdd}`;
    const totalKey    = `push:cap:t:${userId}:${yyyymmdd}`;
    // 86400s TTL covers the entire day. Subsequent INCRs reuse the existing
    // TTL (Redis behaviour) so we don't keep bumping it.
    const TTL = 60 * 60 * 24;
    const brandCount = await this.cache.incrWithTtl(perBrandKey, TTL);
    if (brandCount > CAP_PER_BRAND_PER_DAY) return false;
    const totalCount = await this.cache.incrWithTtl(totalKey, TTL);
    if (totalCount > CAP_PER_DAY_TOTAL) return false;
    return true;
  }

  /// Deliver a push to all of one customer's registered devices.
  /// Returns `ok: true` if at least one device accepted the payload; the
  /// caller's counter only ticks once per customer regardless of how many
  /// devices they registered. `failedTokens` counts dead/unregistered tokens
  /// for the job-level "failed" metric and (in a future enhancement) we'd
  /// strip those tokens off the customer profile to stop wasting them.
  ///
  /// When Firebase isn't configured (no service-account in env), falls back
  /// to a [PUSH-STUB] log line so dev iteration still works end-to-end.
  private async deliver(
    recipient: { userId: string; fcmTokens: string[]; distanceKm: number },
    offer: { id: string; title: string; description: string | null },
  ): Promise<{ ok: boolean; failedTokens: number; deadTokens: string[] }> {
    const fcmReady = this.firebase.isEnabled();
    const title = offer.title;
    const body = offer.description
      ? offer.description.slice(0, 140)
      : 'Tap to view this deal.';
    const data: Record<string, string> = {
      offerId: offer.id,
      kind: 'OFFER',
      ...(Number.isFinite(recipient.distanceKm) && recipient.distanceKm >= 0
        ? { distanceKm: recipient.distanceKm.toFixed(2) }
        : {}),
    };

    let anyOk = false;
    let failedTokens = 0;
    const deadTokens: string[] = [];
    for (const token of recipient.fcmTokens) {
      if (!fcmReady) {
        this.logger.log(
          `[PUSH-STUB] offer=${offer.id} user=${recipient.userId} token=${token.slice(0, 10)}… ` +
          `distance=${data.distanceKm ?? 'n/a'}km · ${title}`,
        );
        anyOk = true;
        continue;
      }
      const result = await this.firebase.sendPush(token, { title, body, data });
      if (result.ok) {
        anyOk = true;
      } else {
        failedTokens++;
        if (result.deadToken) deadTokens.push(token);
      }
    }
    if (deadTokens.length > 0) {
      await this.pruneDeadTokens(recipient.userId, deadTokens);
    }
    return { ok: anyOk, failedTokens, deadTokens };
  }

  /// Remove FCM tokens FCM flagged as unregistered/invalid so we stop wasting
  /// API calls on them. Optimistic read-modify-write — the tokens array is
  /// capped at 10 per profile so the small race window is acceptable.
  private async pruneDeadTokens(userId: string, dead: string[]): Promise<void> {
    const deadSet = new Set(dead);
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { fcmTokens: true },
    });
    if (!profile) return;
    const next = profile.fcmTokens.filter((t) => !deadSet.has(t));
    if (next.length === profile.fcmTokens.length) return; // nothing to do
    await this.prisma.customerProfile.update({
      where: { userId },
      data: { fcmTokens: next },
    });
    this.logger.log(`Pruned ${dead.length} dead FCM token(s) for user ${userId}`);
  }

  private async complete(
    jobId: string,
    counts: { planned: number; capped: number; deferred: number; sent: number; failed: number },
  ): Promise<NotifyResult> {
    const updated = await this.prisma.pushJob.update({
      where: { id: jobId },
      data: {
        status: PushJobStatus.COMPLETED,
        recipientsPlanned: counts.planned,
        recipientsCapped: counts.capped,
        recipientsDeferred: counts.deferred,
        recipientsSent: counts.sent,
        recipientsFailed: counts.failed,
        finishedAt: new Date(),
      },
    });
    return { jobId: updated.id, status: updated.status, ...counts };
  }
}

function yyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/// Reconstruct the audience from the placeholder we stashed on the job row.
/// Returns undefined if the marker is missing — caller defaults to BOTH.
function parseAudience(marker: string | null): PushAudience | undefined {
  if (!marker) return undefined;
  const m = /audience=(NEARBY|FOLLOWERS|BOTH)/.exec(marker);
  return m ? (m[1] as PushAudience) : undefined;
}

/// Returns true if the wall-clock hour in PUSH_QUIET_TZ (defaults to
/// Asia/Kolkata) is within the quiet window [QUIET_END, QUIET_START) — i.e.
/// >= QUIET_START or < QUIET_END. With the defaults (21, 9), this is the
/// 9pm–9am customer-comfort silent window.
function isInQuietHours(): boolean {
  const tz   = process.env.PUSH_QUIET_TZ ?? 'Asia/Kolkata';
  const start = Number(process.env.PUSH_QUIET_START_HOUR ?? '21'); // inclusive
  const end   = Number(process.env.PUSH_QUIET_END_HOUR ?? '9');    // exclusive
  // Get the hour-of-day in the configured timezone.
  const hour = Number(
    new Date().toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: tz }),
  );
  if (Number.isNaN(hour)) return false;
  // Window wraps midnight when start > end (the usual case).
  return start > end ? (hour >= start || hour < end) : (hour >= start && hour < end);
}
