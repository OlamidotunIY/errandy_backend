import { Injectable } from '@nestjs/common';
import { EventBus, ofType, Saga } from '@nestjs/cqrs';
import { ignoreElements, mergeMap, Observable } from 'rxjs';
import {
  IPartyRepository,
  PartyNotFoundError,
  ProviderRoleNotFoundError,
} from '@module/party';
import {
  TrustedCircleMemberConfirmedEvent,
  TrustedCircleMemberRemovedEvent,
} from '@module/trusted-circle';
import { ILogger } from '@src/common';

@Injectable()
export class TrustedByCountSyncSaga {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  @Saga()
  trustedByCountSync = (events$: Observable<any>): Observable<never> => {
    return events$.pipe(
      ofType(
        TrustedCircleMemberConfirmedEvent,
        TrustedCircleMemberRemovedEvent,
      ),
      mergeMap(async (event) => {
        const partyId = event.payload.partyId;
        const party = await this.partyRepository.findById(partyId);

        if (!party) {
          throw new PartyNotFoundError(partyId);
        }

        if (!party.providerRole) {
          throw new ProviderRoleNotFoundError(partyId);
        }

        if (event instanceof TrustedCircleMemberConfirmedEvent) {
          party.providerRole.incrementTrustedByCount();
        } else {
          party.providerRole.decrementTrustedByCount();
        }

        await this.partyRepository.save(party);

        for (const domainEvent of party.pullDomainEvents()) {
          this.eventBus.publish(domainEvent);
        }

        this.logger.info('Trusted-by count synced', { partyId });
      }),
      ignoreElements(),
    );
  };
}
