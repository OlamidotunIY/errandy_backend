import { Injectable } from '@nestjs/common';
import { ICommand, ofType, Saga } from '@nestjs/cqrs';
import { map, Observable } from 'rxjs';
import { ApplicationAcceptedEvent } from '@module/application';
import { AddProviderRoleCommand } from '@module/party';

@Injectable()
export class TrustedByCountSyncSaga {
  @Saga()
  ensureProviderRole = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(ApplicationAcceptedEvent),
      map(
        (event) =>
          new AddProviderRoleCommand({
            partyId: event.payload.workerId.value,
          }),
      ),
    );
  };
}
