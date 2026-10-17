import { Global, Logger, Module } from '@nestjs/common';
import { QueueModule } from '../infrastructure/queue/queue.module';
import { CqrsModule } from '@nestjs/cqrs';
import {
  CommandRetryRegistry,
  EventRetryProcessor,
  EventRetryQueueService,
  ILogger,
} from './application';
import { IDeadLetterRepository } from './domain';
import { PrismaDeadLetterRepository } from './infrastructure';

class NestLoggerAdapter extends ILogger {
  private readonly logger = new Logger('App');

  info(message: string, context?: Record<string, unknown>): void {
    this.logger.log(context ? `${message} ${JSON.stringify(context)}` : message);
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void {
    this.logger.error(
      context ? `${message} ${JSON.stringify(context)}` : message,
      error?.stack,
    );
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.logger.warn(
      context ? `${message} ${JSON.stringify(context)}` : message,
    );
  }
}

@Global()
@Module({
  imports: [QueueModule, CqrsModule],
  providers: [
    {
      provide: ILogger,
      useClass: NestLoggerAdapter,
    },
    {
      provide: IDeadLetterRepository,
      useClass: PrismaDeadLetterRepository,
    },
    CommandRetryRegistry,
    EventRetryQueueService,
    EventRetryProcessor,
  ],

  exports: [
    ILogger,
    IDeadLetterRepository,
    CommandRetryRegistry,
    EventRetryQueueService,
    EventRetryProcessor,
  ],
})
export class CommonModule {}
