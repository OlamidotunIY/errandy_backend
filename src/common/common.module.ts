import { Global, Module } from '@nestjs/common';
import { IDeadLetterRepository } from '@shared/domain';
import { PrismaDeadLetterRepository } from '@shared/infrastructure';
import {
  CommandRetryRegistry,
  EventRetryProcessor,
  EventRetryQueueService,
} from '@shared/application';
import { QueueModule } from '../infrastructure/queue/queue.module';
import { CommandBus } from '@nestjs/cqrs';

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
