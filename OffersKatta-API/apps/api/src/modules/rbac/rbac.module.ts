import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionsGuard } from './permissions.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  providers: [PermissionsService, PermissionsGuard, RolesGuard],
  exports: [PermissionsService, PermissionsGuard, RolesGuard],
})
export class RbacModule {}
