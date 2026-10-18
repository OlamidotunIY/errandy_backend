import { startOtel } from './infrastructure/observability';

startOtel('errandy-worker');

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrapWorker() {
  const logger = new Logger('Worker');
  logger.log('Starting Errandy Background Worker...');

  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();

  logger.log('🚀 Errandy Background Worker is running.');
}

bootstrapWorker().catch((error) => {
  console.error('Failed to start Errandy Background Worker:', error);
  process.exit(1);
});
