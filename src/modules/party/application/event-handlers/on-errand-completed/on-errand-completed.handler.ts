import { ErrandCompletedEvent } from '@module/errands';
import { EventBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { IPartyRepository } from '@module/party';
import { ILogger } from '@src/common';
import { PrismaService } from '@src/prisma/prisma.service';

@EventsHandler(ErrandCompletedEvent)
export class OnErrandCompletedHandler implements IEventHandler<ErrandCompletedEvent> {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
    private readonly prisma: PrismaService,
  ) {}

  async handle(event: ErrandCompletedEvent): Promise<void> {
    const escrowId = event.payload.escrowId;

    const escrow = await this.prisma.escrow.findUnique({
      where: { id: escrowId },
      select: {
        workerId: true,
        clientId: true,
      },
    });

    if (!escrow) {
      this.logger.warn('Escrow not found for errand completed event', {
        escrowId,
      });
      return;
    }

    const affectedPartyIds = [...new Set([escrow.workerId, escrow.clientId])];

    for (const partyId of affectedPartyIds) {
      const party = await this.partyRepository.findById(partyId);
      if (!party?.providerRole) {
        continue;
      }

      party.providerRole.incrementCompletedErrandsCount();
      await this.partyRepository.save(party);

      for (const domainEvent of party.pullDomainEvents()) {
        this.eventBus.publish(domainEvent);
      }
    }

    this.logger.info('Errand completed handled for party stats', {
      escrowId,
    });
  }
}
