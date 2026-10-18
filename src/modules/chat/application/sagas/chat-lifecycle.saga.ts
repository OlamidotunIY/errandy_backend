import { Injectable } from '@nestjs/common';
import { CommandBus, ofType, Saga } from '@nestjs/cqrs';
import { ignoreElements, mergeMap, Observable } from 'rxjs';
import {
  ErrandAssignedEvent,
  ErrandCompletedEvent,
  ErrandArchivedEvent,
} from '@module/errands/domain';
import {
  CloseChatThreadCommand,
  OpenChatThreadCommand,
} from '../commands';
import { IChatThreadRepository } from '../../domain';
import { IErrandReadPort, ILogger, IPartyReadPort } from '@src/common';

@Injectable()
export class ChatLifecycleSaga {
  constructor(
    private readonly errandReadPort: IErrandReadPort,
    private readonly partyReadPort: IPartyReadPort,
    private readonly chatThreadRepository: IChatThreadRepository,
    private readonly commandBus: CommandBus,
    private readonly logger: ILogger,
  ) {}

  @Saga()
  openChatThreadOnErrandAssigned = (
    events$: Observable<any>,
  ): Observable<never> => {
    return events$.pipe(
      ofType(ErrandAssignedEvent),
      mergeMap(async (event: ErrandAssignedEvent) => {
        const { errandId } = event.payload;

        const errand = await this.errandReadPort.findById(errandId);
        if (!errand) {
          this.logger.warn('ChatLifecycleSaga: errand not found', {
            errandId,
          });
          return;
        }

        const assignments =
          await this.errandReadPort.findAssignmentsByErrandId(errandId);
        if (assignments.length === 0) {
          this.logger.warn('ChatLifecycleSaga: no assignments found', {
            errandId,
          });
          return;
        }

        const clientParty = await this.partyReadPort.findById(
          errand.clientPartyId,
        );
        if (!clientParty?.personUserId) {
          this.logger.warn('ChatLifecycleSaga: client party/person not found', {
            errandId,
            clientPartyId: errand.clientPartyId,
          });
          return;
        }

        const participantIds = new Set<string>([
          clientParty.personUserId,
        ]);

        for (const assignment of assignments) {
          const providerParty = await this.partyReadPort.findById(
            assignment.providerPartyId,
          );
          if (providerParty?.personUserId) {
            participantIds.add(providerParty.personUserId);
          }
        }

        await this.commandBus.execute(
          new OpenChatThreadCommand({
            errandId,
            participantIds: Array.from(participantIds),
          }),
        );

        this.logger.info('Chat thread opened for errand', { errandId });
      }),
      ignoreElements(),
    );
  };

  @Saga()
  closeChatThreadOnErrandEnded = (
    events$: Observable<any>,
  ): Observable<never> => {
    return events$.pipe(
      ofType(ErrandCompletedEvent, ErrandArchivedEvent),
      mergeMap(async (event: ErrandCompletedEvent | ErrandArchivedEvent) => {
        const { errandId } = event.payload;

        const thread = await this.chatThreadRepository.findByErrandId(errandId);
        if (!thread) {
          return;
        }

        await this.commandBus.execute(
          new CloseChatThreadCommand({ threadId: thread.id.value }),
        );

        this.logger.info('Chat thread closed for errand', { errandId });
      }),
      ignoreElements(),
    );
  };
}
