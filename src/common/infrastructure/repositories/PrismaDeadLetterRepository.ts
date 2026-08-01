import { ILogger } from '@src/common/application';
import { InputJsonValue } from '@prisma/client/runtime/edge';
import { DeadLetterEntry, IDeadLetterRepository } from '@src/common/domain';
import { PrismaService } from '@src/prisma/prisma.service';

export class PrismaDeadLetterRepository implements IDeadLetterRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: ILogger,
  ) {}

  async record(entry: DeadLetterEntry): Promise<void> {
    const { failureReason, payload, queueName, isPermanent, attemptsMade } =
      entry;

    if (isPermanent) {
      this.logger.error(
        `Permanent failure in queue ${queueName}: ${failureReason}`,
        {} as Error,
        {
          payload,
          attemptsMade,
        },
      );
    }

    await this.prisma.deadLetterEntry.create({
      data: {
        id: crypto.randomUUID(),
        attemptsMade,
        failureReason,
        isPermanent,
        payload: payload as InputJsonValue,
        queueName,
        createdAt: new Date(),
      },
    });

    this.logger.info(`Recorded dead letter entry for queue ${queueName}`, {
      payload,
      attemptsMade,
    });
  }
}
