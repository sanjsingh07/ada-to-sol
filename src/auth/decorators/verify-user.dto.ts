import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import type { DataSignature } from '@meshsdk/common';


export class UserSginatureDto {
  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @IsString()
  @IsNotEmpty()
  signature: DataSignature;
}