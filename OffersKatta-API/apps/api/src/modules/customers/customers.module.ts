import { Module } from '@nestjs/common';
import { CustomersController, PushPreviewController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  controllers: [CustomersController, PushPreviewController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
