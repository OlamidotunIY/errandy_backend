import { Module, Global } from '@nestjs/common';
import { PubSubService } from './pubsub.service';

@Global()
@Module({
  providers: [
    PubSubService,
    {
      provide: 'PUB_SUB',
      useExisting: PubSubService,
    },
  ],
  exports: [PubSubService, 'PUB_SUB'],
})
export class PubSubModule {}