import { Controller, Get, Query } from '@nestjs/common';
import { ChangeNowService } from './change-now.service';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('changenow')
export class ChangeNowController {
  constructor(private readonly changeNowService: ChangeNowService) {}

  @Get('exchange/min-amount')
  @Public() // IDK if we need to make this public?
  async getMinAmount(
    @Query('fromCurrency') fromCurrency: string,
    @Query('toCurrency') toCurrency: string,
    @Query('fromNetwork') fromNetwork: string,
    @Query('toNetwork') toNetwork: string,
    @Query('flow') flow?: string,
  ) {
    return this.changeNowService.getMinAmount({
      fromCurrency,
      toCurrency,
      fromNetwork,
      toNetwork,
      flow,
    });
  }

  
}
