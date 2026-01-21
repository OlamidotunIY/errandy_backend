import { Module } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { PresenceResolver } from './presence.resolver';

@Module({
  providers: [PresenceService, PresenceResolver]
})
export class PresenceModule {}
