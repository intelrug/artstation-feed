import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'subscriptions' })
export class Subscription {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({
    name: 'chat_id',
    type: 'int',
  })
  chatId: number;

  @Column({
    type: 'varchar',
    length: 191,
  })
  author: string;

  @Column({
    type: 'int',
    nullable: true,
  })
  timestamp?: number;
}
