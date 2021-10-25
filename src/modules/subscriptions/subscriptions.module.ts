import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SubscriptionsUpdate } from '~/modules/subscriptions/subscriptions.update';

import { SubscriptionsRepository } from './repositories';
import { SubscriptionsService } from './services';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionsRepository,
    ]),
  ],
  providers: [
    SubscriptionsService,
    SubscriptionsUpdate,
  ],
  exports: [],
})
export class SubscriptionsModule {}
