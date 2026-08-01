import { Injectable } from '@nestjs/common';
import { ICommand, ofType, Saga } from '@nestjs/cqrs';
import { map, Observable } from 'rxjs';
import {
  ApplicationAcceptedEvent,
  RejectOtherApplicationsCommand,
} from '@src/modules';

@Injectable()
class RejectOtherApplicationsSaga {
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
