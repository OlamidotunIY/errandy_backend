import { Args, ID, Query, Resolver, Subscription } from '@nestjs/graphql';
import { PubSubService } from '../pubsub/pubsub.service';
import { PresenceService } from './presence.service';
import { PresenceStatus, UserPresence } from './entities/presence.entity';
import { PRESENCE_CHANGED_EVENT } from './presence.publicher';

@Resolver(() => UserPresence)
export class PresenceResolver {
  constructor(
    private readonly presenceService: PresenceService,
    private readonly pubSub: PubSubService,
  ) {}

  @Query(() => UserPresence)
  async presence(
    @Args('userId', { type: () => ID }) userId: string,
  ): Promise<UserPresence> {
    const online = await this.presenceService.isOnline(userId);
    const lastSeen = await this.presenceService.getLastSeen(userId);

    return {
      userId,
      status: online ? PresenceStatus.ONLINE : PresenceStatus.OFFLINE,
      lastSeenAt: lastSeen ? new Date(lastSeen) : undefined,
    };
  }

  @Subscription(() => UserPresence, {
    filter: (payload, variables) => {
      const changedUserId = payload?.presenceChanged?.userId;
      const filterUserIds: string[] | undefined = variables?.userIds;

      if (!filterUserIds?.length) return true;
      return filterUserIds.includes(changedUserId);
    },
  })
  presenceChanged(
    @Args('userIds', { type: () => [ID], nullable: true }) userIds?: string[],
  ) {
    return this.pubSub.asyncIterator(PRESENCE_CHANGED_EVENT);
  }
}
