import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  type PermissionRequirement,
} from '../../common/decorators/permissions.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { PermissionsService } from './permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionRequirement[] | undefined>(
      PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = ctx
      .switchToHttp()
      .getRequest<{ user?: AuthUser; params: Record<string, string>; body: Record<string, unknown> }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('No authenticated user');

    for (const need of required) {
      const scope = this.extractScope(need, req);
      const ok = await this.permissions.hasPermission(user.id, need.resource, need.action, scope);
      if (!ok) {
        throw new ForbiddenException(
          `Missing permission: ${need.resource}:${need.action}${scope ? ` on ${scope.type} ${scope.id}` : ''}`,
        );
      }
    }
    return true;
  }

  private extractScope(
    need: PermissionRequirement,
    req: { params: Record<string, string>; body: Record<string, unknown> },
  ): { type: 'BRAND' | 'BRANCH'; id: string } | undefined {
    if (!need.scopeParam || !need.scopeType) return undefined;
    const fromParams = req.params[need.scopeParam];
    const fromBody = (req.body[need.scopeParam] as string | undefined) ?? undefined;
    const id = fromParams ?? fromBody;
    if (!id) return undefined;
    return { type: need.scopeType, id };
  }
}
