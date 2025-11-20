import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChangeNowModule } from './change-now/change-now.module';
import { CardanoModule } from './cardano/cardano.module';
import { CardanoProviderService } from './cardano-provider/cardano-provider.service';

@Module({
  imports: [ConfigModule.forRoot(), AuthModule, UsersModule, ChangeNowModule, CardanoModule],
  controllers: [AppController],
  providers: [AppService, CardanoProviderService],
})
export class AppModule {}