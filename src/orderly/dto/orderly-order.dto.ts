import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsIn,
  Min,
  Max,
  IsInt,
  IsNotEmpty
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @IsString()
  symbol: string; // PERP_SOL_USDC

  @IsIn(['LIMIT', 'MARKET', 'IOC', 'FOK', 'POST_ONLY', 'ASK', 'BID'])
  order_type: string;

  @IsIn(['BUY', 'SELL'])
  side: 'BUY' | 'SELL';

  @IsOptional()
  @IsString()
  client_order_id?: string;

  @IsOptional()
  @IsNumber()
  order_price?: number;

  @IsOptional()
  @IsNumber()
  order_quantity?: number;

  @IsOptional()
  @IsNumber()
  order_amount?: number;

  @IsOptional()
  @IsNumber()
  visible_quantity?: number;

  @IsOptional()
  @IsBoolean()
  reduce_only?: boolean;

  @IsOptional()
  @IsNumber()
  slippage?: number;

  @IsOptional()
  @IsString()
  order_tag?: string;

  @IsOptional()
  @IsNumber()
  level?: number;

  @IsOptional()
  @IsBoolean()
  post_only_adjust?: boolean;
}

export class EditOrderDto {
  @IsString()
  order_id: string;

  @IsString()
  symbol: string;

  @IsIn(['LIMIT', 'IOC', 'FOK', 'POST_ONLY', 'ASK', 'BID', 'MARKET'])
  order_type: string;

  @IsIn(['BUY', 'SELL'])
  side: 'BUY' | 'SELL';

  @IsOptional()
  @IsString()
  client_order_id?: string;

  // ⚠️ Only ONE of these is allowed
  @IsOptional()
  @IsNumber()
  order_price?: number;

  @IsOptional()
  @IsNumber()
  order_quantity?: number;

  @IsOptional()
  @IsNumber()
  order_amount?: number;

  @IsOptional()
  @IsBoolean()
  reduce_only?: boolean;

  @IsOptional()
  @IsNumber()
  visible_quantity?: number;

  @IsOptional()
  @IsString()
  order_tag?: string;
}

export class CancelAllAfterDto {
  @IsNumber()
  @Min(0)
  @Max(900000)
  trigger_after: number; // milliseconds
}

export class GetOrdersDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsIn(['BUY', 'SELL'])
  side?: 'BUY' | 'SELL';

  @IsOptional()
  @IsIn(['LIMIT', 'MARKET'])
  order_type?: 'LIMIT' | 'MARKET';

  @IsOptional()
  @IsIn([
    'NEW',
    'CANCELLED',
    'PARTIAL_FILLED',
    'FILLED',
    'REJECTED',
    'INCOMPLETE',
    'COMPLETED',
  ])
  status?: string;

  @IsOptional()
  @IsString()
  order_tag?: string;

  @IsOptional()
  @IsNumber()
  start_t?: number;

  @IsOptional()
  @IsNumber()
  end_t?: number;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  size?: number;

  @IsOptional()
  @IsIn([
    'CREATED_TIME_DESC',
    'CREATED_TIME_ASC',
    'UPDATED_TIME_DESC',
    'UPDATED_TIME_ASC',
  ])
  sort_by?: string;
}

export class GetTradesDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsNumber()
  start_t?: number; // 13-digit timestamp

  @IsOptional()
  @IsNumber()
  end_t?: number; // 13-digit timestamp

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  @Max(500)
  size?: number;
}

export class SettlePnlDto {
  @IsString()
  signature: string; // EIP-712 signature from wallet

  @IsString()
  userAddress: string; // solana address

  @IsNumber()
  settleNonce: number;
}

export class PnlSettlementHistoryDto {
  @IsOptional()
  @IsInt()
  start_t?: number; // unix ms

  @IsOptional()
  @IsInt()
  end_t?: number; // unix ms

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  size?: number = 50;
}

export class InternalTransferHistoryDto {
  @IsIn(['IN', 'OUT'])
  side: 'IN' | 'OUT';

  @IsOptional()
  @IsIn(['CREATED', 'PENDING', 'COMPLETED', 'FAILED'])
  status?: string;

  @IsOptional()
  @IsString()
  start_t?: string;

  @IsOptional()
  @IsString()
  end_t?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  size?: number;

  @IsOptional()
  @IsString()
  from_account_id?: string;

  @IsOptional()
  @IsString()
  to_account_id?: string;

  @IsOptional()
  @IsBoolean()
  main_sub_only?: boolean;
}

export class PositionHistoryQueryDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class GetAssetHistoryDto {
  @IsOptional()
  @IsString()
  token?: string; // SOL, USDC

  @IsOptional()
  @IsIn(['DEPOSIT', 'WITHDRAW'])
  side?: 'DEPOSIT' | 'WITHDRAW';

  @IsOptional()
  @IsIn([
    'NEW',
    'CONFIRM',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'PENDING_REBALANCE',
  ])
  status?: string;

  @IsOptional()
  @IsNumber()
  start_t?: number;

  @IsOptional()
  @IsNumber()
  end_t?: number;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  size?: number;
}

/**
 * Amount is passed in lamports
 * Frontend must convert SOL → lamports
 */
export class WithdrawSolDto {
  @IsString()
  @IsNotEmpty()
  amountLamports: string;
}




