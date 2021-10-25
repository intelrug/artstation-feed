import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const PORT = Number.parseInt(process.env.PORT || '4020', 10);

  const app = await NestFactory.create(AppModule);
  await app.listen(PORT);
}
bootstrap();
