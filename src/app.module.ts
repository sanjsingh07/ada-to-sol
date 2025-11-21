import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChangeNowModule } from './change-now/change-now.module';
import { CardanoModule } from './cardano/cardano.module';
import { CardanoConfig } from './config/cardano.config';

@Module({
  imports: [
    // ConfigModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => ({
        cardano: {
          network: process.env.CARDANO_NETWORK || 'preprod',
          blockfrostApiKey: process.env.BLOCKFROST_API_KEY!,
          blockfrostUrl: process.env.BLOCKFROST_URL!,
        } as CardanoConfig,
      })],
    }),
    AuthModule, 
    UsersModule, 
    ChangeNowModule, 
    CardanoModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}