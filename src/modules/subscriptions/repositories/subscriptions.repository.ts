import { NotFoundException } from '@nestjs/common';
import {
  EntityRepository,
  Repository,
} from 'typeorm';

import { Subscription } from '../entities/subscriptions.entity';

@EntityRepository(Subscription)
export class SubscriptionsRepository extends Repository<Subscription> {
  async listByChatId(chatId: number): Promise<Subscription[]> {
    return this.find({ where: { chatId } });
  }

  async getByAuthor(chatId: number, author: string): Promise<Subscription | undefined> {
    return this.findOne({ where: { chatId, author } });
  }

  async removeByChatId(chatId: number, id: number): Promise<void> {
    const entity = await this.findOne({ where: { chatId, id } });
    if (!entity) {
      throw new NotFoundException();
    }

    await this.delete(entity.id);
  }

  async exists(chatId: number, author: string): Promise<boolean> {
    return !!await this.findOne({ where: { chatId, author } });
  }
}
