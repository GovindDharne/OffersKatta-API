import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';

class CreateOrderDto {
  @ApiProperty() @IsUUID() brandId!: string;
  @ApiProperty() @IsNumber() @Min(1) amount!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
}

class VerifyPaymentDto {
  @ApiProperty() @IsString() razorpayOrderId!: string;
  @ApiProperty() @IsString() razorpayPaymentId!: string;
  @ApiProperty() @IsString() razorpaySignature!: string;
}

class CreateBoostOrderDto {
  @ApiProperty() @IsUUID() offerId!: string;
  @ApiProperty() @IsInt() @Min(1) days!: number;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @ApiBearerAuth()
  @Post('create-order')
  @ApiOperation({ summary: 'Create a Razorpay order for a brand (returns order_id for client SDK)' })
  createOrder(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthUser) {
    return this.payments.createOrder(dto.brandId, user.id, dto.amount, dto.description);
  }

  @ApiBearerAuth()
  @Post('verify')
  @ApiOperation({ summary: 'Verify a Razorpay payment signature after successful checkout' })
  verify(@Body() dto: VerifyPaymentDto) {
    return this.payments.verifyPayment(dto.razorpayOrderId, dto.razorpayPaymentId, dto.razorpaySignature);
  }

  @ApiBearerAuth()
  @Get('config')
  @ApiOperation({ summary: 'Razorpay availability + public key id for the browser SDK' })
  config() {
    return this.payments.getConfig();
  }

  @ApiBearerAuth()
  @Get('boost/options')
  @ApiOperation({ summary: 'Available offer-boost durations + pricing' })
  boostOptions() {
    return this.payments.getBoostOptions();
  }

  @ApiBearerAuth()
  @Post('boost/create-order')
  @ApiOperation({ summary: 'Create a Razorpay order to boost (feature) an offer' })
  createBoostOrder(@Body() dto: CreateBoostOrderDto, @CurrentUser() user: AuthUser) {
    return this.payments.createBoostOrder(dto.offerId, dto.days, user.id);
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Razorpay webhook (signature-verified)' })
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Body() body: unknown,
  ) {
    if (!signature) throw new BadRequestException('Missing webhook signature');
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(body);
    return this.payments.handleWebhook(rawBody, signature);
  }

  @ApiBearerAuth()
  @Get('brand/:brandId')
  list(@Param('brandId') brandId: string, @CurrentUser() user: AuthUser) {
    return this.payments.listForBrand(brandId, user.id);
  }
}
