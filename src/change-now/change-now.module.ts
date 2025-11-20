import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChangeNowService } from './change-now.service';
import { ChangeNowController } from './change-now.controller';
import { DatabaseModule } from 'src/database/database.module';
import { CardanoModule } from 'src/cardano/cardano.module';

@Module({
  imports: [HttpModule, DatabaseModule, CardanoModule],         // <── REQUIRED
  controllers: [ChangeNowController],
  providers: [ChangeNowService],
  exports: [ChangeNowService],   // (optional)
})
export class ChangeNowModule {}
