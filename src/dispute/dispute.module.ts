import { Module } from '@nestjs/common';
import { DisputeService } from './dispute.service';

@Module({
  providers: [DisputeService]
})
export class DisputeModule {}
