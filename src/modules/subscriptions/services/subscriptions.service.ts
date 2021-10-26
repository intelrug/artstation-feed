import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Cron,
  CronExpression,
} from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import got, { Got } from 'got';
import { DateTime } from 'luxon';
import { InjectBot } from 'nestjs-telegraf';
import {
  Context,
  Telegraf,
} from 'telegraf';

import {
  httpErrorsTransformer,
  sleep,
} from '~/common/utils/utils';
import { UserProject } from '~/modules/subscriptions/types/user-project';
import { UserProjectsResponse } from '~/modules/subscriptions/types/user-projects-response';

import { Subscription } from '../entities';
import { SubscriptionsRepository } from '../repositories';

@Injectable()
export class SubscriptionsService {
  private readonly httpClient: Got;

  private lastProjectId: number = 0;

  public constructor(
    @InjectRepository(SubscriptionsRepository)
    private readonly subscriptionsRepository: SubscriptionsRepository,
    @InjectBot() private bot: Telegraf<Context>,
  ) {
    this.httpClient = got.extend({
      prefixUrl: 'https://www.artstation.com/',
      headers: {
        Accept: 'application/atom+xml,application/rss+xml;q=0.9,application/rdf+xml;q=0.8,application/xml;q=0.7,text/xml;q=0.7,*/*;q=0.1',
        'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        DNT: '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:93.0) Gecko/20100101 Firefox/93.0',
      },
    });
  }

  public async getSubscriptions(chatId: number): Promise<Subscription[]> {
    return this.subscriptionsRepository.listByChatId(chatId);
  }

  public async fetchAuthorsLastProject(author: string): Promise<UserProject | undefined> {
    try {
      const response = await this.httpClient
        .get(`users/${author}/projects.json?sorting=latest&per_page=1`)
        .json<UserProjectsResponse>();

      return response.data[0] ?? undefined;
    } catch (error) {
      httpErrorsTransformer(error);
    }

    return undefined;
  }

  public async fetchProjects(): Promise<UserProject[]> {
    try {
      const response = await this.httpClient
        .get('projects.json?page=1&sorting=latest&per_page=50')
        .json<UserProjectsResponse>();

      return response.data;
    } catch (error) {
      httpErrorsTransformer(error);
    }

    return [];
  }

  public async createSubscription(chatId: number, author: string): Promise<Subscription> {
    const exists = await this.subscriptionsRepository.exists(chatId, author);
    if (exists) {
      throw new Error('ALREADY_EXISTS');
    }

    const project = await this.fetchAuthorsLastProject(author);

    let entity: Subscription;

    if (project) {
      const timestamp = Math.floor(DateTime.fromISO(project.created_at).toSeconds());
      entity = this.subscriptionsRepository.create(
        { chatId, author, timestamp },
      );
    } else {
      entity = this.subscriptionsRepository.create(
        { chatId, author },
      );
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

  @Cron(CronExpression.EVERY_MINUTE)
  public async getUpdates(): Promise<void> {
    const subscriptions = await this.subscriptionsRepository.find();

    let projects = await this.fetchProjects();
    projects = projects.filter((project) => project.id > this.lastProjectId);

    for (let i = projects.length - 1; i >= 0; --i) {
      const project = projects[i];

      const chats = await this.getChatsByAuthor(project.user.username, subscriptions);

      for (let j = 0; j < chats.length; ++j) {
        const timestamp = Math.floor(DateTime.fromISO(project.created_at).toSeconds());
        const subscription = await this.getSubscriptionLessThanTimestamp(
          project.user.username, chats[j], timestamp,
        );

        if (subscription) {
          await this.bot.telegram.sendMessage(
            chats[j],
            `New art from ${project.user.username}\n${project.permalink}`,
          );
          await this.subscriptionsRepository.update(
            { author: project.user.username, chatId: chats[j] },
            { timestamp },
          );
          await sleep(500);
        }
      }

      this.lastProjectId = project.id;
    }
  }
}
