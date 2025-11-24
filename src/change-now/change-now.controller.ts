import { Controller, Get, Query, Post, Body, Req } from '@nestjs/common';
import { ChangeNowService } from './change-now.service';
import { Public } from 'src/auth/decorators/public.decorator';
import { ChangeNowExchangeDto } from './dto/exchange-request.dto';

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

  // Maybe we dont need to as it is, 
  // since we will be the once invoking the Tx
  @Post('exchange')
  createExchange(@Body() dto: ChangeNowExchangeDto, @Req() req: any) {
    
    const walletAddress = req.user.sub;

    return this.changeNowService.createExchangeAndSend(walletAddress, dto);
  }

  // TEST FUNCTION
  // @Get('sendtx')
  // sendTransaction(@Req() req: any) {
  //   const walletAddress = req.user.sub;
  //   return this.changeNowService.sendTransaction(walletAddress);
  // }
  

}
