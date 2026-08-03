import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EventRetryPayload } from '..';
import { Queue } from 'bullmq';

@Injectable()
class EventRetryQueueService {
  constructor(
    @InjectQueue('event-retry')
    private readonly queue: Queue<EventRetryPayload>,
  ) {}

  async enqueueRetry(payload: EventRetryPayload): Promise<void> {
    await this.queue.add('retry', payload, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }
}

export { EventRetryQueueService };
