import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ChangeNowService } from './change-now.service';
import { ChangeNowController } from './change-now.controller';

@Module({
  imports: [HttpModule],         // <── REQUIRED
  controllers: [ChangeNowController],
  providers: [ChangeNowService],
  exports: [ChangeNowService],   // (optional)
})
export class ChangeNowModule {}
