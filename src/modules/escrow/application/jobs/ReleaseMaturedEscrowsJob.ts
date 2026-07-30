import { EscrowRepository } from 'src/modules/escrow/domain';
import { ILogger } from '@shared';
import { Queue } from 'bullmq';
import { ReleaseMaturedEscrowsPayload } from 'src/modules/escrow/application';

export class ReleaseMaturedEscrowsJob {
  constructor(
    private readonly escrowRepository: EscrowRepository,
    private readonly logger: ILogger,
    private readonly releaseMaturedEscrowsQueue: Queue<ReleaseMaturedEscrowsPayload>,
  ) {}

  async enqueueDueJobs(): Promise<void> {
    try {
      const maturedEscrow = await this.escrowRepository.findMaturedForRelease();

      for (const escrow of maturedEscrow) {
        const payload: ReleaseMaturedEscrowsPayload = {
          id: escrow.id,
          correlationId: crypto.randomUUID(),
        };

        await this.releaseMaturedEscrowsQueue.add(
          'release-matured-escrow',
          payload,
          {
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          },
        );
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error('Error enqueuing due jobs', error);
      } else {
        this.logger.error('Error enqueuing due jobs', new Error(String(error)));
      }
    }
  }
}
