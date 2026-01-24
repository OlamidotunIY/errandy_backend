import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class EscrowScheduler implements OnModuleInit {
  private readonly logger = new Logger(EscrowScheduler.name);

  constructor(@InjectQueue('escrow') private readonly escrowQueue: Queue) {}

  async onModuleInit() {
    const limit = Number(process.env.ESCROW_RELEASE_LIMIT ?? 50);

    await this.escrowQueue.add(
      'release-eligible',
      { limit },
      {
        repeat: { every: 120_000 },
        jobId: 'escrow:release-eligible',
      },
    );

    this.logger.log(
      'Scheduled repeatable job "escrow:release-eligible" every 2 minutes',
    );
  }
}

