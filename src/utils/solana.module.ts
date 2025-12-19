import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SolanaClient } from './solana.client';

@Module({
  imports: [ConfigModule],
  providers: [SolanaClient],
  exports: [SolanaClient],
})
export class SolanaModule {}
