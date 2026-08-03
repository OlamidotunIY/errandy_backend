import { Global, Module } from '@nestjs/common';
import { QueueModule } from '../infrastructure/queue/queue.module';
import { CommandBus } from '@nestjs/cqrs';
import {
  CommandRetryRegistry,
  EventRetryProcessor,
  EventRetryQueueService,
  IDeadLetterRepository,
  PrismaDeadLetterRepository,
} from '.';

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
