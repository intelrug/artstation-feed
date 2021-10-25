import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Command,
  On,
  Start,
  Update,
} from 'nestjs-telegraf';
import {
  Context,
  Markup,
} from 'telegraf';
import {
  Message,
  Update as TypegramUpdate,
} from 'typegram';

import { Subscription } from '~/modules/subscriptions/entities';
import { SubscriptionsService } from '~/modules/subscriptions/services';
import { Action } from '~/modules/subscriptions/types';

import MessageUpdate = TypegramUpdate.MessageUpdate;
import TextMessage = Message.TextMessage;

@Update()
export class SubscriptionsUpdate {
  private readonly actionsMemory: Record<number, Action> = {};

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Start()
  async startCommand(context: Context): Promise<void> {
    const keyboard = Markup.keyboard([[
      { text: '/list' },
      { text: '/add' },
      { text: '/remove' },
    ]]).resize(true);

    await context.reply('Выберите действие:', keyboard);
  }

  @Command('list')
  async listCommand(context: Context): Promise<void> {
    if (!context.chat?.id) return;

    try {
      const message = await this.getSubscriptions(context.chat.id);
      await context.reply(message);
    } catch (error) {
      if (error instanceof NotFoundException) {
        await context.reply('Вы ещё не подписаны ни на одного автора.');
      }
    }
  }

  @Command('add')
  async addCommand(context: Context): Promise<void> {
    if (!context.chat?.id) return;

    this.actionsMemory[context.chat.id] = Action.ADD_SUBSCRIPTION;
    await context.reply('Введите идентификатор автора, на которого вы хотите подписаться.');
  }

  @Command('remove')
  async removeCommand(context: Context): Promise<void> {
    if (!context.chat?.id) return;

    this.actionsMemory[context.chat.id] = Action.REMOVE_SUBSCRIPTION;
    try {
      const subscriptionsMessage = await this.getSubscriptions(context.chat.id);
      await context.reply(subscriptionsMessage);
      await context.reply('Введите идентификатор или номер из списка автора, от которого вы хотите отписаться.');
    } catch (error) {
      if (error instanceof NotFoundException) {
        await context.reply('Вы ещё не подписаны ни на одного автора.');
      } else {
        await context.reply('Произошла неизвестная ошибка.');
      }
    }
  }

  @On('message')
  async onMessage(context: Context): Promise<void> {
    const chatId = context.chat?.id;
    if (!chatId) return;

    switch (this.actionsMemory[chatId]) {
      case Action.ADD_SUBSCRIPTION:
        await this.addSubscription(context);
        break;
      case Action.REMOVE_SUBSCRIPTION:
        await this.removeSubscription(context);
        break;
      default:
        break;
    }
  }

  async getSubscriptions(chatId: number): Promise<string> {
    const subscriptions = await this.subscriptionsService.getSubscriptions(chatId);
    if (subscriptions.length === 0) {
      throw new NotFoundException();
    } else {
      let message = 'Список авторов, на которых вы подписаны:\n\n';

      subscriptions.forEach((subscription, i) => {
        message += `${i + 1}. ${subscription.author}\n`;
      });

      return message;
    }
  }

  async addSubscription(context: Context): Promise<void> {
    if (context.updateType !== 'message') return;
    const message = (context.update as MessageUpdate).message as TextMessage;

    if (!message.text || message.text.includes(' ')) {
      await context.reply('Неверный формат идентификатора! Попробуйте ещё раз.');
      return;
    }

    try {
      const subscription = await this.subscriptionsService.createSubscription(message.chat.id, message.text);
      await context.reply(`Вы успешно подписались на ${subscription.author}`);
    } catch (error) {
      if (error.message === 'ALREADY_EXISTS') {
        await context.reply('Вы уже подписаны на этого автора.');
      } else if (error instanceof NotFoundException) {
        await context.reply('Автор с таким идентификатором не найден.');
      } else if (error instanceof ForbiddenException) {
        await context.reply('Бот не может получить данные с ArtStation, попробуйте снова через несколько часов.');
      } else {
        await context.reply('Произошла неизвестная ошибка');
      }
    } finally {
      delete this.actionsMemory[message.chat.id];
    }
  }

  async removeSubscription(context: Context): Promise<void> {
    if (context.updateType !== 'message') return;
    const message = (context.update as MessageUpdate).message as TextMessage;

    if (!message.text || message.text.includes(' ')) {
      await context.reply('Неверный формат идентификатора! Попробуйте ещё раз.');
    }

    try {
      let subscription: Subscription;

      if (/\d+/.test(message.text)) {
        subscription = await this.subscriptionsService.removeSubscriptionByOrderNumber(
          message.chat.id,
          Number(message.text),
        );
      } else {
        subscription = await this.subscriptionsService.removeSubscriptionByAuthor(
          message.chat.id,
          message.text,
        );
      }
      await context.reply(`Вы успешно отписались от ${subscription.author}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        await context.reply('Такой подписки не существует.');
      } else {
        await context.reply('Произошла неизвестная ошибка.');
      }
    } finally {
      delete this.actionsMemory[message.chat.id];
    }
  }
}
