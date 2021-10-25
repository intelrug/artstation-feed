import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegrafModule } from 'nestjs-telegraf';

import { TypeOrmConfigService } from '~/common/typeorm';
import { SubscriptionsModule } from '~/modules/subscriptions/subscriptions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '.env.local'] }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
    }),
    TelegrafModule.forRoot({
      token: process.env.TELEGRAM_TOKEN || '',
    }),
    ScheduleModule.forRoot(),
    SubscriptionsModule,
  ],
})
export class AppModule {}
