import { Global, Module } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { QueueModule } from '@src/infrastructure/queue/queue.module';
import { IDeadLetterRepository } from './domain';
import { PrismaDeadLetterRepository } from './infrastructure';
import {
  CommandRetryRegistry,
  EventRetryProcessor,
  EventRetryQueueService,
} from './application';

@Global()
@Module({
  imports: [QueueModule],
  providers: [
    {
      provide: IDeadLetterRepository,
      useClass: PrismaDeadLetterRepository,
    },
    CommandRetryRegistry,
    EventRetryQueueService,
    EventRetryProcessor,
    CommandBus,
  ],

  exports: [
    IDeadLetterRepository,
    CommandRetryRegistry,
    EventRetryQueueService,
    EventRetryProcessor,
  ],
})
export class CommonModule {}
