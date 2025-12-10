import { Controller, Post, Body, Req, UseGuards, Get } from '@nestjs/common';
import { OrderlyService } from './orderly.service';
import { RegisterOrderlyDto } from './dto/register-orderly.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('orderly')
export class OrderlyController {
  constructor(private readonly orderly: OrderlyService) {}

  // Protected endpoint - expects JWT; if you prefer public, remove UseGuards and get walletAddress from body
  @UseGuards(AuthGuard)
  @Post('register')
  async register(@Req() req: any, @Body() dto: RegisterOrderlyDto) {
    // try to obtain walletAddress from JWT payload (req.user.sub) or body
    const walletAddress = dto.walletAddress ?? req?.user?.sub;
    const brokerId = dto.brokerId ?? process.env.ORDERLY_BROKER_ID ?? 'woofi_dex';
    // chainId: use config or default to Solana chain id per Orderly (they have mapping); expose via env if needed
    const chainId = Number(process.env.ORDERLY_CHAIN_ID ?? 101);
    return this.orderly.registerAccountForUser(walletAddress, brokerId, chainId);
  }

  @UseGuards(AuthGuard)
  @Get('status')
  async status(@Req() req: any) {
    const walletAddress = req?.user?.sub;
    return this.orderly.getAccountStatus(walletAddress);
  }
}