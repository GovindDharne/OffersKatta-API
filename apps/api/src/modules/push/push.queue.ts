import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';

import { PushService } from './push.service';

const QUEUE_NAME = 'offer-push';

/// Job payload — just the PushJob row id. The worker re-fetches the row at
/// processing time so any stale data (eg radius edits) is picked up live.
interface OfferPushJobData {
  pushJobId: string;
}

/// Owns the BullMQ Queue + Worker for offer pushes. Both share one ioredis
/// connection to the same Redis instance the cache uses. The Worker runs
/// in-process — fine for a few hundred concurrent recipients/min. When you
/// need to scale further, deploy a separate api container with WORKER_ONLY=1
/// and the same code path will run as a dedicated worker.
@Injectable()
export class PushQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushQueueService.name);
  private queue!: Queue<OfferPushJobData>;
  private worker?: Worker<OfferPushJobData>;

  constructor(
    private readonly config: ConfigService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit(): Promise<void> {
    const connection: ConnectionOptions = this.buildRedisConnection();
    this.queue = new Queue<OfferPushJobData>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 500, age: 60 * 60 * 24 }, // keep last 500 / 1d
        removeOnFail:     { count: 200, age: 60 * 60 * 24 * 7 },
      },
    });

    // Don't start a worker in pure-API processes when a separate worker is
    // deployed; toggled via env so production can split processes cleanly.
    const apiOnly = this.config.get<string>('API_ONLY') === '1';
    if (apiOnly) {
      this.logger.log('API_ONLY=1 — skipping in-process push worker');
      return;
    }

    const concurrency = Number(this.config.get<string>('PUSH_WORKER_CONCURRENCY') ?? 4);
    this.worker = new Worker<OfferPushJobData>(
      QUEUE_NAME,
      async (job) => {
        const push = this.moduleRef.get(PushService, { strict: false });
        await push.processJob(job.data.pushJobId);
      },
      { connection, concurrency },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.warn(`push job ${job?.data?.pushJobId} failed: ${err.message}`);
    });
    this.worker.on('completed', (job) => {
      this.logger.debug?.(`push job ${job.data.pushJobId} done`);
    });
    this.logger.log(`In-process push worker started (concurrency=${concurrency})`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  /// Enqueue one push job. `priority` follows BullMQ semantics: lower = sooner.
  async enqueue(pushJobId: string, priority: number): Promise<string> {
    const job = await this.queue.add(
      'notify-offer',
      { pushJobId },
      { priority, jobId: pushJobId }, // jobId = idempotency key
    );
    return job.id ?? pushJobId;
  }

  private buildRedisConnection(): ConnectionOptions {
    // Same Redis the cache module uses — keeps deployment simple.
    const url = this.config.get<string>('REDIS_URL') ?? 'redis://redis:6379';
    return { url, maxRetriesPerRequest: null } as ConnectionOptions;
  }
}
