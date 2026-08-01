import { ApplicationRejectedEvent } from '@module/application';
import { InjectQueue } from '@nestjs/bullmq';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Queue } from 'bullmq';
import { MonthlyTrustStatsPayload } from '@module/party';

@EventsHandler(ApplicationRejectedEvent)
export class OnApplicationRejectedHandler implements IEventHandler<ApplicationRejectedEvent> {
  constructor(
    @InjectQueue('party-monthly-trust-stats')
    private readonly monthlyTrustStatsQueue: Queue<MonthlyTrustStatsPayload>,
  ) {}

  async handle(event: ApplicationRejectedEvent): Promise<void> {
    const workerIdRaw = (event.payload as Record<string, unknown>).workerId as
      { value?: string } | string | undefined;
    const workerPartyId =
      typeof workerIdRaw === 'string'
        ? workerIdRaw
        : (workerIdRaw?.value ?? '');

    if (!workerPartyId) {
      return;
    }

    await this.monthlyTrustStatsQueue.add('monthly-trust-stats', {
      partyId: workerPartyId,
      delta: -1,
    });
  }
}
