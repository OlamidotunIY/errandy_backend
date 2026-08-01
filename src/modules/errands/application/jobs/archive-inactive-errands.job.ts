import { IErrandRepository, ErrandStatus } from '@module/errands/domain';
import { ILogger } from '@src/common';

export class ArchiveInactiveErrandsJob {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly logger: ILogger,
  ) {}

  async run(): Promise<void> {
    const threshold = new Date();
    threshold.setMonth(threshold.getMonth() - 3);

    const inactiveErrands =
      await this.errandRepository.findInactiveOlderThan(threshold);

    for (const errand of inactiveErrands) {
      if (
        errand.status !== ErrandStatus.DRAFT &&
        errand.status !== ErrandStatus.PUBLISHED
      ) {
        continue;
      }

      errand.archive(crypto.randomUUID());
      await this.errandRepository.save(errand);

      this.logger.info('Errand archived for inactivity', {
        errandId: errand.id.value,
      });
    }
  }
}
