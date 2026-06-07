import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/// Best-effort JWT auth. Unlike the global JwtAuthGuard, this never rejects:
/// if a valid bearer token is present it attaches req.user, otherwise the
/// request proceeds anonymously. Used on otherwise-public catalog routes
/// (GET /branches, GET /offers) so a signed-in territory manager gets a
/// territory-scoped view while anonymous/customer traffic still works.
///
/// Pair it with @Public() — @Public() bypasses the mandatory global guard,
/// and this layered guard then does the opportunistic authentication.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Swallow auth errors and missing-user — return whatever passport resolved
  // (user object or undefined) without throwing.
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return (user ?? undefined) as TUser;
  }

  // canActivate must resolve truthy so the route always runs. AuthGuard's
  // canActivate may reject when no token is present; coerce to true.
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(ctx);
    } catch {
      /* no/invalid token — continue anonymously */
    }
    return true;
  }
}
