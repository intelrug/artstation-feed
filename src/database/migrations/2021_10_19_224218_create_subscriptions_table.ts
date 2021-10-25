import {
  MigrationInterface,
  QueryRunner,
  Table,
} from 'typeorm';

export class CreateSubscriptionsTable implements MigrationInterface {
  name = 'create_subscriptions_table_1634672538123';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'subscriptions',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'chat_id',
            type: 'int',
          },
          {
            name: 'author',
            type: 'varchar',
            length: '191',
          },
          {
            name: 'timestamp',
            type: 'int',
            isNullable: true,
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('subscriptions');
  }
}
