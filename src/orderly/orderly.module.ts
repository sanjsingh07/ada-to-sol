import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { OrderlyService } from './orderly.service';
import { OrderlyController } from './orderly.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [HttpModule, ConfigModule, DatabaseModule],
  providers: [OrderlyService],
  controllers: [OrderlyController],
  exports: [OrderlyService],
})
export class OrderlyModule {}