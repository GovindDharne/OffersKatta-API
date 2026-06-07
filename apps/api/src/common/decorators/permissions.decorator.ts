import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export interface PermissionRequirement {
  resource: string;
  action: string;
  scopeParam?: string;
  scopeType?: 'BRAND' | 'BRANCH';
}

/**
 * Declare required permission(s) for a route. Use `scopeParam` to indicate
 * which request param holds the scoped resource id (e.g. branchId, brandId);
 * the guard will verify the user has that permission for that scope.
 */
export const RequirePermission = (
  ...permissions: PermissionRequirement[]
): MethodDecorator & ClassDecorator => SetMetadata(PERMISSIONS_KEY, permissions);
