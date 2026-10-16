import { Injectable } from '@nestjs/common';
import { ICommand, ofType, Saga } from '@nestjs/cqrs';
import { map, Observable } from 'rxjs';
import { ApplicationAcceptedEvent } from '../../domain';
import { RejectOtherApplicationsCommand } from '../commands/reject-other-applications';

@Injectable()
export class RejectOtherApplicationsSaga {
  @Saga()
  applicationAccepted = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(ApplicationAcceptedEvent),
      map(
        (event) =>
          new RejectOtherApplicationsCommand({
            acceptedApplicationId: event.payload.applicationId,
            errandId: event.payload.errandId,
            correlationId: event.correlationId,
          }),
      ),
    );
  };
}
