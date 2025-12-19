import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChangeNowService } from './change-now.service';
import { ChangeNowController } from './change-now.controller';
import { DatabaseModule } from 'src/database/database.module';
import { CardanoModule } from 'src/cardano/cardano.module';
import { SolanaModule } from 'src/utils/solana.module';

@Module({
  imports: [HttpModule, DatabaseModule, CardanoModule, SolanaModule],         // <── REQUIRED
  controllers: [ChangeNowController],
  providers: [ChangeNowService],
  exports: [ChangeNowService],   // (optional)
})
export class ChangeNowModule {}
