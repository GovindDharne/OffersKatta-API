import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { StatesService } from './states.service';

@ApiTags('states')
@Controller('states')
export class StatesController {
  constructor(private readonly states: StatesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List Indian states + union territories (for the State dropdown)' })
  list() {
    return this.states.list();
  }
}
