import { Module } from '@nestjs/common';
import { CardanoService } from './cardano.service';

@Module({
  providers: [CardanoService],
  exports: [CardanoService]
})
export class CardanoModule {}
