import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EscrowService } from 'src/escrow/escrow.service';

type ReleaseEligibleJobData = {
  limit?: number;
};

@Processor('escrow', { concurrency: 5 })
export class EscrowProcessor extends WorkerHost {
  private readonly logger = new Logger(EscrowProcessor.name);

  constructor(private readonly escrowService: EscrowService) {
    super();
  }

  async process(job: Job<ReleaseEligibleJobData>) {
    if (job.name !== 'release-eligible') {
      this.logger.warn(`Unknown job name="${job.name}" id="${job.id}"`);
      return;
    }

    const startedAt = Date.now();
    const limit = Number(job.data?.limit ?? process.env.ESCROW_RELEASE_LIMIT ?? 50);

    const result = await this.escrowService.releaseEligibleEscrows(limit);

    this.logger.log(
      `job="${job.id}" name="${job.name}" scanned=${result.scanned} released=${result.released} skipped=${result.skipped} durationMs=${Date.now() - startedAt}`,
    );

    return result;
  }
}

