import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ChangeNowModule } from './change-now/change-now.module';

@Module({
  imports: [ConfigModule.forRoot(), AuthModule, UsersModule, ChangeNowModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}