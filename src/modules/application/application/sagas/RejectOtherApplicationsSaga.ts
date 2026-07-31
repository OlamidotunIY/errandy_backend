import { Injectable } from '@nestjs/common';
import { ICommand, ofType, Saga } from '@nestjs/cqrs';
import { map, Observable } from 'rxjs';
import {
  ApplicationAcceptedEvent,
  ApplicationId,
  RejectOtherApplicationsCommand,
} from '@src/modules';
import { ErrandId } from '@module/errand';

@Injectable()
class RejectOtherApplicationsSaga {
  @Saga()
  applicationAccepted = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(ApplicationAcceptedEvent),
      map(
        (event) =>
          new RejectOtherApplicationsCommand({
            acceptedApplicationId: event.payload.applicationId as ApplicationId,
            errandId: event.payload.errandId as ErrandId,
            correlationId: event.correlationId,
          }),
      ),
    );
  };
}
