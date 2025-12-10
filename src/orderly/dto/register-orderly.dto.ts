import { IsOptional, IsString } from 'class-validator';

export class RegisterOrderlyDto {
  @IsOptional()
  @IsString()
  walletAddress?: string;

  @IsOptional()
  @IsString()
  brokerId?: string; // builder id like 'woofi_dex'
}