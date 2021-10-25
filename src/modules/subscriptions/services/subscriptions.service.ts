import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Cron,
  CronExpression,
} from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import got, { HTTPError } from 'got';
import { DateTime } from 'luxon';
import { InjectBot } from 'nestjs-telegraf';
import * as Parser from 'rss-parser';
import {
  Context,
  Telegraf,
} from 'telegraf';

import { sleep } from '~/common/utils/utils';

import { Subscription } from '../entities';
import { SubscriptionsRepository } from '../repositories';

const rssParser = new Parser();

@Injectable()
export class SubscriptionsService {
  public constructor(
    @InjectRepository(SubscriptionsRepository)
    private readonly subscriptionsRepository: SubscriptionsRepository,
    @InjectBot() private bot: Telegraf<Context>,
  ) {}

  public async getSubscriptions(chatId: number): Promise<Subscription[]> {
    return this.subscriptionsRepository.listByChatId(chatId);
  }

  public async getRSSFeedByAuthor(author: string): Promise<Parser.Output<unknown>> {
    try {
      const response = await got.get(`https://www.artstation.com/${author}.rss?sorting=latest`, {
        headers: {
          Accept: 'application/atom+xml,application/rss+xml;q=0.9,application/rdf+xml;q=0.8,application/xml;q=0.7,text/xml;q=0.7,*/*;q=0.1',
          'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3',
          'Accept-Encoding': 'gzip, deflate, br',
          DNT: '1',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:78.0) Gecko/20100101 Thunderbird/78.11.0',
        },
      });
      return await rssParser.parseString(response.body);
    } catch (error) {
      if (error instanceof HTTPError) {
        if (error.response.statusCode === 404) {
          throw new NotFoundException();
        } else if (error.response.statusCode === 403) {
          if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
            await this.bot.telegram.sendMessage(process.env.TELEGRAM_ADMIN_CHAT_ID, 'HttpError: 403 Forbidden');
          }
          throw new ForbiddenException();
        }
      }

      if (process.env.TELEGRAM_ADMIN_CHAT_ID) {
        await this.bot.telegram.sendMessage(process.env.TELEGRAM_ADMIN_CHAT_ID, 'Unknown Exception');
      }
      throw error;
    }
  }

  public async createSubscription(chatId: number, author: string): Promise<Subscription> {
    const exists = await this.subscriptionsRepository.exists(chatId, author);
    if (exists) {
      throw new Error('ALREADY_EXISTS');
    }

    const feed = await this.getRSSFeedByAuthor(author);

    let entity: Subscription;

    if (feed.items[0] && feed.items[0].isoDate) {
      entity = this.subscriptionsRepository.create({
        chatId,
        author,
        timestamp: DateTime.fromISO(feed.items[0].isoDate).toSeconds(),
      });
    } else {
      entity = this.subscriptionsRepository.create({ chatId, author });
    }

    return this.subscriptionsRepository.save(entity);
  }

  public async removeSubscriptionByAuthor(chatId: number, author: string): Promise<Subscription> {
    const subscription = await this.subscriptionsRepository.getByAuthor(chatId, author);
    if (!subscription) {
      throw new NotFoundException();
    }

    await this.subscriptionsRepository.removeByChatId(chatId, subscription.id);
    return subscription;
  }

  public async removeSubscriptionByOrderNumber(chatId: number, number: number): Promise<Subscription> {
    const subscriptions = await this.subscriptionsRepository.listByChatId(chatId);
    if (!subscriptions[number - 1]) {
      throw new NotFoundException();
    }

    await this.subscriptionsRepository.removeByChatId(chatId, subscriptions[number - 1].id);
    return subscriptions[number - 1];
  }

  public async getAuthors(subscriptions?: Subscription[]): Promise<string[]> {
    const localSubscriptions = subscriptions ?? await this.subscriptionsRepository.find();

    const authors = localSubscriptions
      .map((subscription) => subscription.author);
    return [...new Set(authors)];
  }

  public async getChatsByAuthor(author: string, subscriptions?: Subscription[]): Promise<number[]> {
    const localSubscriptions = subscriptions ?? await this.subscriptionsRepository.find();

    return localSubscriptions
      .filter((subscription) => subscription.author === author)
      .map((subscription) => subscription.chatId);
  }

  public async getSubscriptionLessThanTimestamp(
    author: string,
    chatId: number,
    timestamp: number,
    subscriptions?: Subscription[],
  ): Promise<Subscription | undefined> {
    let subscription: Subscription | undefined;

    if (subscriptions) {
      subscription = subscriptions
        .find((sub) => sub.author === author && sub.chatId === chatId);
    } else {
      subscription = await this.subscriptionsRepository.findOne({
        where: { author, chatId },
      });
    }

    if (subscription) {
      if (!subscription.timestamp) return subscription;
      return subscription.timestamp < timestamp ? subscription : undefined;
    }

    return undefined;
  }

  public getFeedItems(feed: Parser.Output<unknown>)
    : Parser.Output<unknown>['items'] & { timestamp: number }[] {
    return feed.items
      .filter((item) => item.isoDate)
      .map((item) => ({
        ...item,
        timestamp: item.isoDate
          ? DateTime.fromISO(item.isoDate).toSeconds()
          : DateTime.local().toSeconds(),
      }));
  }

  @Cron(CronExpression.EVERY_HOUR)
  public async getRSSUpdates(): Promise<void> {
    const subscriptions = await this.subscriptionsRepository.find();
    const authors = await this.getAuthors(subscriptions);

    for (let i = 0; i < authors.length; ++i) {
      const author = authors[i];

      try {
        const feed = await this.getRSSFeedByAuthor(authors[i]);
        const chats = await this.getChatsByAuthor(author, subscriptions);
        const arts = this.getFeedItems(feed);

        for (let j = arts.length - 1; j > 0; --j) {
          const art = arts[j];

          for (let k = 0; k < chats.length; ++k) {
            const chatId = chats[k];

            const subscription = await this.getSubscriptionLessThanTimestamp(
              author, chatId, art.timestamp,
            );

            if (subscription) {
              await this.bot.telegram.sendMessage(chats[k], `New art from ${author}\n${art.link}`);
              await this.subscriptionsRepository.update(
                { author, chatId },
                { timestamp: art.timestamp },
              );
              await sleep(500);
            }
          }
        }

        await sleep(15 * 1000);
      } catch (error) {
        if (error instanceof ForbiddenException) {
          break;
        }
      }
    }
  }
}
