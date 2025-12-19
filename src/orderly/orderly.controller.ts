import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  Get,
  Delete,
  Put,
  Query,
  BadRequestException,
  Param,
} from '@nestjs/common';
import { OrderlyService } from './orderly.service';
import { RegisterOrderlyDto } from './dto/register-orderly.dto';
import { AuthGuard } from 'src/auth/auth.guard';
import {
  CreateOrderDto,
  EditOrderDto,
  CancelAllAfterDto,
  GetOrdersDto,
  GetTradesDto,
  SettlePnlDto,
  PnlSettlementHistoryDto,
  InternalTransferHistoryDto,
  PositionHistoryQueryDto,
  GetAssetHistoryDto,
  WithdrawSolDto,
} from './dto/orderly-order.dto';
import {
  CreateAlgoOrderDto,
  EditAlgoOrderDto,
  GetAlgoOrdersDto,
} from './dto/orderly-algo-order.dto';

@Controller('orderly')
export class OrderlyController {
  constructor(private readonly orderly: OrderlyService) {}

  // Protected endpoint - expects JWT; if you prefer public, remove UseGuards and get walletAddress from body
  @UseGuards(AuthGuard)
  @Post('register')
  async register(@Req() req: any, @Body() dto: RegisterOrderlyDto) {
    // try to obtain walletAddress from JWT payload (req.user.sub) or body
    const walletAddress = dto.walletAddress ?? req?.user?.sub;
    const brokerId =
      dto.brokerId ?? process.env.ORDERLY_BROKER_ID ?? 'woofi_dex';
    // chainId: use config or default to Solana chain id per Orderly (they have mapping); expose via env if needed
    const chainId = Number(process.env.ORDERLY_CHAIN_ID ?? 101);
    return this.orderly.registerAccountForUser(
      walletAddress,
      brokerId,
      chainId,
    );
  }

  @UseGuards(AuthGuard)
  @Get('status')
  async status(@Req() req: any) {
    const walletAddress = req?.user?.sub;
    return this.orderly.getAccountStatus(walletAddress);
  }

  @UseGuards(AuthGuard)
  @Post('order')
  createOrder(@Req() req: any, @Body() dto: CreateOrderDto) {
    return this.orderly.createOrder(req.user.sub, dto);
  }

  @Post('algo/order')
  createAlgoOrder(
    @Req() req: any,
    @Body() dto: CreateAlgoOrderDto | CreateAlgoOrderDto[],
  ) {
    return this.orderly.createAlgoOrder(req.user.sub, dto);
  }

  @Put('order')
  editOrder(@Req() req: any, @Body() dto: EditOrderDto) {
    return this.orderly.editOrder(req.user.sub, dto);
  }

  @Put('algo/order')
  editAlgoOrder(@Req() req: any, @Body() dto: EditAlgoOrderDto) {
    return this.orderly.editAlgoOrder(req.user.sub, dto);
  }

  @Delete('order')
  cancelOrder(
    @Req() req: any,
    @Query('symbol') symbol: string,
    @Query('order_id') orderId: string,
  ) {
    if (!symbol || !orderId) {
      throw new BadRequestException('symbol and order_id are required');
    }

    return this.orderly.cancelOrder(
      req.user.sub, // walletAddress from JWT
      symbol,
      Number(orderId),
    );
  }

  @Delete('algo/order')
  cancelAlgoOrder(
    @Req() req: any,
    @Query('order_id') orderId: string,
    @Query('symbol') symbol: string,
  ) {
    return this.orderly.cancelAlgoOrder(req.user.sub, {
      orderId: Number(orderId),
      symbol,
    });
  }

  @Delete('client/order')
  cancelByClientOrderId(
    @Req() req: any,
    @Query('client_order_id') clientOrderId: string,
    @Query('symbol') symbol: string,
  ) {
    return this.orderly.cancelOrderByClientOrderId(
      req.user.sub,
      clientOrderId,
      symbol,
    );
  }

  @Delete('algo/client/order')
  cancelAlgoOrderByOrderId(
    @Req() req: any,
    @Query('symbol') symbol: string,
    @Query('client_order_id') clientOrderId: string,
  ) {
    return this.orderly.cancelAlgoOrderByClientId(
      req.user.sub, // walletAddress from JWT
      symbol,
      clientOrderId,
    );
  }

  @Delete('algo/orders')
  cancelAllAlgoOrders(
    @Req() req: any,
    @Query('symbol') symbol?: string,
    @Query('algo_type') algo_type?: 'STOP' | 'TAKE_PROFIT' | 'STOP_LOSS',
  ) {
    return this.orderly.cancelAllAlgoOrders(req.user.sub, {
      symbol,
      algo_type,
    });
  }

  @Delete('orders')
  cancelAllOrders(@Req() req: any, @Query('symbol') symbol?: string) {
    return this.orderly.cancelAllOrders(req.user.sub, symbol);
  }

  @Post('order/cancel-all-after')
  cancelAllAfter(@Req() req: any, @Body() dto: CancelAllAfterDto) {
    return this.orderly.cancelAllAfter(req.user.sub, dto.trigger_after);
  }

  @Get('order/:orderId')
  getOrder(@Req() req: any, @Param('orderId') orderId: string) {
    return this.orderly.getOrderById(req.user.sub, orderId);
  }

  @Get('order/:clientOrderId')
  getOrderByClientOrderId(
    @Req() req: any,
    @Param('clientOrderId') clientOrderId: string,
  ) {
    return this.orderly.getOrderByClientOrderId(req.user.sub, clientOrderId);
  }

  @Get('algo/order/:orderId')
  getAlgoOrder(@Req() req: any, @Param('orderId') orderId: string) {
    return this.orderly.getAlgoOrderById(
      req.user.sub, // walletAddress from JWT
      orderId,
    );
  }

  @Get('algo/client/order/:clientOrderId')
  getAlgoOrderByClientOrderId(
    @Req() req: any,
    @Param('clientOrderId') clientOrderId: string,
  ) {
    return this.orderly.getAlgoOrderByClientOrderId(
      req.user.sub,
      clientOrderId,
    );
  }

  @Get('orders')
  getOrders(@Req() req: any, @Query() query: GetOrdersDto) {
    return this.orderly.getOrders(req.user.sub, query);
  }

  @Get('algo/orders')
  getAlgoOrders(@Req() req: any, @Query() query: GetAlgoOrdersDto) {
    return this.orderly.getAlgoOrders(req.user.sub, query);
  }

  @Get('trades')
  getTrades(@Req() req: any, @Query() query: GetTradesDto) {
    return this.orderly.getTrades(req.user.sub, query);
  }

  @Get('trade/:tradeId')
  getTrade(@Req() req: any, @Param('tradeId') tradeId: string) {
    return this.orderly.getTrade(
      req.user.sub, // walletAddress from JWT
      Number(tradeId),
    );
  }

  @Get('order/:orderId/trades')
  getOrderTrades(@Req() req: any, @Param('orderId') orderId: string) {
    return this.orderly.getOrderTrades(
      req.user.sub, // walletAddress from JWT
      Number(orderId),
    );
  }

  @Get('algo/order/:orderId/trades')
  getAlgoOrderTrades(@Req() req: any, @Param('orderId') orderId: string) {
    return this.orderly.getAlgoOrderTrades(
      req.user.sub, // walletAddress from JWT
      Number(orderId),
    );
  }

  @Get('holding')
  getHolding(@Req() req: any, @Query('all') all?: string) {
    return this.orderly.getCurrentHolding(req.user.sub, all === 'true');
  }

  @Get('settle-nonce')
  getSettleNonce(@Req() req: any) {
    return this.orderly.getSettleNonce(req.user.sub);
  }

  @Post('settle-pnl')
  settlePnl(@Req() req: any, @Body() dto: SettlePnlDto) {
    return this.orderly.settlePnl(req.user.sub, dto);
  }

  @Get('pnl/settlement-history')
  getPnlSettlementHistory(
    @Req() req: any,
    @Query() query: PnlSettlementHistoryDto,
  ) {
    return this.orderly.getPnlSettlementHistory(req.user.sub, query);
  }

  @Get('transfer-nonce')
  getTransferNonce(@Req() req: any) {
    return this.orderly.getTransferNonce(req.user.sub);
  }

  @Post('internal-transfer')
  createInternalTransfer(
    @Req() req: any,
    @Body()
    body: {
      amount: string;
      token?: string;
    },
  ) {
    return this.orderly.createInternalTransfer({
      walletAddress: req.user.sub,
      token: body.token || 'sol',
      amount: BigInt(body.amount),
    });
  }

  @Get('internal-transfer-history')
  getInternalTransferHistory(
    @Req() req: any,
    @Query() query: InternalTransferHistoryDto,
  ) {
    return this.orderly.getInternalTransferHistory(req.user.sub, query);
  }

  @Get('positions')
  getPositions(@Req() req: any) {
    return this.orderly.getPositions(req.user.sub);
  }

  @Get('position/:symbol')
  getPosition(@Req() req: any, @Param('symbol') symbol: string) {
    return this.orderly.getPosition(req.user.sub, symbol);
  }

  @Get('position-history')
  getPositionHistory(@Req() req: any, @Query() query: PositionHistoryQueryDto) {
    return this.orderly.getPositionHistory(req.user.sub, query);
  }

  @Get('asset/history')
  getAssetHistory(@Req() req: any, @Query() query: GetAssetHistoryDto) {
    return this.orderly.getAssetHistory(req.user.sub, query);
  }

  /**
   * Initiate SOL withdrawal from Orderly
   */
  @Post('withdraw')
  async withdrawSol(@Req() req: any, @Body() dto: WithdrawSolDto) {
    const walletAddress = req.user?.sub;

    if (!walletAddress) {
      throw new BadRequestException('Wallet address missing');
    }

    return this.orderly.withdrawSol({
      walletAddress,
      amountLamports: BigInt(dto.amountLamports),
    });
  }
}
