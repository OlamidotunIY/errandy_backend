import { Injectable } from '@nestjs/common';
import { PubSubService } from '../pubsub/pubsub.service';
import { PresenceStatus } from './entities/presence.entity';

export const PRESENCE_CHANGED_EVENT = 'presence.changed';

@Injectable()
export class PresencePublisher {
  constructor(private readonly pubSub: PubSubService) {}

  async publish(userId: string, status: PresenceStatus, lastSeenAt?: Date) {
    await this.pubSub.publish(PRESENCE_CHANGED_EVENT, {
      presenceChanged: {
        userId,
        status,
        lastSeenAt: lastSeenAt ?? null,
      },
    });
  }
}
