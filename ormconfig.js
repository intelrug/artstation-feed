const production = process.env.NODE_ENV === 'production';
const { CustomNamingStrategy } = production
  // eslint-disable-next-line import/no-unresolved
  ? require('./dist/common/typeorm/naming-strategy.js')
  : require('./src/common/typeorm/naming-strategy.ts');

const host = process.env.TYPEORM_HOST;
const port = process.env.TYPEORM_PORT;
const username = process.env.TYPEORM_USERNAME;
const password = process.env.TYPEORM_PASSWORD;
const database = process.env.TYPEORM_DATABASE;
const logging = process.env.TYPEORM_LOGGING === 'true';
const migrationsRun = process.env.TYPEORM_MIGRATIONS_RUN === 'true';

module.exports = {
  type: 'mysql',
  host,
  port,
  username,
  password,
  database,
  synchronize: false,
  migrationsRun,
  timezone: 'Z',
  logging,
  entities: production ? ['dist/**/*.entity.js'] : ['src/**/*.entity.ts'],
  migrations: production ? ['dist/database/migrations/*.js'] : ['src/database/migrations/*.ts'],
  subscribers: production ? ['dist/database/subscribers/*.js'] : ['src/database/subscribers/*.ts'],
  namingStrategy: new CustomNamingStrategy(),
  cli: {
    entitiesDir: 'src/database/entities',
    migrationsDir: 'src/database/migrations',
    subscribersDir: 'src/database/subscribers',
  },
};
