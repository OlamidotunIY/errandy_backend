import { Module } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { PresenceResolver } from './presence.resolver';
import { PresencePublisher } from './presence.publicher';

@Module({
  providers: [PresenceService, PresenceResolver, PresencePublisher],
  exports: [PresenceService, PresencePublisher],
})
export class PresenceModule {}
