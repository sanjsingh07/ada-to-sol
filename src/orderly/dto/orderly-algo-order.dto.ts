import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AlgoChildOrderDto {
  @IsString()
  symbol: string;

  @IsString()
  algo_type: string;

  @IsOptional()
  @IsString()
  side?: 'BUY' | 'SELL';

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsNumber()
  trigger_price?: number;

  @IsOptional()
  @IsString()
  trigger_price_type?: 'MARK_PRICE';

  @IsOptional()
  @IsBoolean()
  reduce_only?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlgoChildOrderDto)
  child_orders?: AlgoChildOrderDto[];
}

export class CreateAlgoOrderDto {
  @IsString()
  symbol: string;

  @IsIn([
    'STOP',
    'TP_SL',
    'POSITIONAL_TP_SL',
    'BRACKET',
    'BRACKET_TP_SL',
    'TRAILING_STOP',
  ])
  algo_type: string;

  @IsOptional()
  @IsString()
  type?: 'LIMIT' | 'MARKET';

  @IsOptional()
  @IsString()
  side?: 'BUY' | 'SELL';

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  trigger_price_type?: 'MARK_PRICE';

  @IsOptional()
  @IsString()
  client_order_id?: string;

  @IsOptional()
  @IsBoolean()
  reduce_only?: boolean;

  @IsOptional()
  @IsNumber()
  visible_quantity?: number;

  @IsOptional()
  @IsString()
  order_tag?: string;

  @IsOptional()
  @IsString()
  activatedPrice?: string;

  @IsOptional()
  @IsString()
  callbackRate?: string;

  @IsOptional()
  @IsString()
  callbackValue?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlgoChildOrderDto)
  child_orders: AlgoChildOrderDto[];
}

export class EditAlgoOrderChildDto {
  @IsString()
  order_id: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsNumber()
  trigger_price?: number;

  @IsOptional()
  @IsString()
  trigger_price_type?: string;

  @IsOptional()
  @IsString()
  is_activated?: string;

  @IsOptional()
  @IsArray()
  child_orders?: EditAlgoOrderChildDto[];
}

export class EditAlgoOrderDto {
  @IsString()
  order_id: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsNumber()
  trigger_price?: number;

  @IsOptional()
  @IsString()
  trigger_price_type?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EditAlgoOrderChildDto)
  child_orders?: EditAlgoOrderChildDto[];
}

export class GetAlgoOrdersDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsIn(['LIMIT', 'MARKET'])
  order_type?: string;

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
  start_t?: number; // 13-digit ms timestamp

  @IsOptional()
  @IsNumber()
  end_t?: number;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  size?: number; // max 500

  @IsOptional()
  @IsIn(['BUY', 'SELL'])
  side?: string;

  @IsOptional()
  @IsIn(['STOP', 'TPSL', 'positional_TPSL'])
  algo_type?: string;

  @IsOptional()
  @IsString()
  is_triggered?: string;
}


