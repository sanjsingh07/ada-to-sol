import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChangeNowModule } from './change-now/change-now.module';
import { CardanoModule } from './cardano/cardano.module';
import { CardanoConfig } from './config/cardano.config';
import { OrderlyModule } from './orderly/orderly.module';
import { SolanaModule } from './utils/solana.module';

@Module({
  imports: [
    // ConfigModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => ({
          cardano: {
            network: process.env.CARDANO_NETWORK || 'preprod',
            blockfrostApiKey: process.env.BLOCKFROST_API_KEY!,
            blockfrostUrl: process.env.BLOCKFROST_URL!,
          } as CardanoConfig,
          ORDERLY_BASE_URL: process.env.ORDERLY_BASE_URL,
          ORDERLY_API_KEY: process.env.ORDERLY_API_KEY,
          ORDERLY_API_SECRET: process.env.ORDERLY_API_SECRET,
          ORDERLY_BROKER_ID: process.env.ORDERLY_BROKER_ID,
          ORDERLY_CHAIN_ID: process.env.ORDERLY_CHAIN_ID,
        }),
      ],
    }),
    AuthModule,
    UsersModule,
    ChangeNowModule,
    CardanoModule,
    OrderlyModule,
    SolanaModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
