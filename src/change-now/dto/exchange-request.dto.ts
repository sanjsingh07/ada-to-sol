import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class ChangeNowExchangeDto {
  @IsString() @IsNotEmpty()
  fromCurrency: string;

  @IsString() @IsNotEmpty()
  toCurrency: string;

  @IsString() @IsNotEmpty()
  fromNetwork: string;

  @IsString() @IsNotEmpty()
  toNetwork: string;

  @IsString() @IsNotEmpty()
  fromAmount: string;

  @IsString() @IsOptional()
  toAmount?: string;

  @IsString() @IsNotEmpty()
  address: string;

  @IsString() @IsOptional()
  extraId?: string;

  @IsString() @IsOptional()
  refundAddress?: string;

  @IsString() @IsOptional()
  refundExtraId?: string;

  @IsString() @IsOptional()
  userId?: string;

  @IsString() @IsOptional()
  payload?: string;

  @IsString() @IsOptional()
  contactEmail?: string;

  @IsString() @IsOptional()
  source?: string;

  @IsString() @IsOptional()
  flow?: string;

  @IsString() @IsOptional()
  type?: string;

  @IsString() @IsOptional()
  rateId?: string;
}
