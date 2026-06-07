import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { BanksService } from './banks.service';

@ApiTags('banks')
@Controller('banks')
export class BanksController {
  constructor(private readonly banks: BanksService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active banks + their card types (cached 24h)' })
  list() {
    return this.banks.list();
  }

  @Public()
  @Get(':bankId/cards')
  @ApiOperation({ summary: 'List card types for a single bank' })
  cards(@Param('bankId') bankId: string) {
    return this.banks.listCardTypes(bankId);
  }
}
