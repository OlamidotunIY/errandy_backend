import { Module, Global } from '@nestjs/common';
import { PubSubService } from './pubsub.service';
import { RedisModule } from '../infrastructure/redis/redis.module';

@Global()
@Module({
  imports: [RedisModule],
  providers: [PubSubService],
  exports: [PubSubService],
})
export class PubSubModule {}
