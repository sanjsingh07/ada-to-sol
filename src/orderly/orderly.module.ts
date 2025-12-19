import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { OrderlyService } from './orderly.service';
import { OrderlyController } from './orderly.controller';
import { DatabaseModule } from 'src/database/database.module';
import { SolanaModule } from 'src/utils/solana.module';

@Module({
  imports: [HttpModule, ConfigModule, DatabaseModule, SolanaModule],
  providers: [OrderlyService],
  controllers: [OrderlyController],
  exports: [OrderlyService],
})
export class OrderlyModule {}