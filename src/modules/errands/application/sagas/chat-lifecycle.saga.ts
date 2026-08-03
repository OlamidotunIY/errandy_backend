import { Injectable } from '@nestjs/common';
import { CommandBus, ofType, Saga } from '@nestjs/cqrs';
import { ignoreElements, mergeMap, Observable } from 'rxjs';
import {
  ErrandAssignedEvent,
  ErrandCompletedEvent,
  ErrandArchivedEvent,
  IErrandRepository,
} from '@module/errands/domain';
import { IPartyRepository } from '@module/party';
import {
  CloseChatThreadCommand,
  IChatThreadRepository,
  OpenChatThreadCommand,
} from '@module/chat';
import { ILogger } from '@src/common';

@Injectable()
export class ChatLifecycleSaga {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly partyRepository: IPartyRepository,
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

        const errand = await this.errandRepository.findById(errandId);
        if (!errand) {
          this.logger.warn('ChatLifecycleSaga: errand not found', {
            errandId,
          });
          return;
        }

        const assignments =
          await this.errandRepository.findAssignmentsByErrandId(errandId);
        if (assignments.length === 0) {
          this.logger.warn('ChatLifecycleSaga: no assignments found', {
            errandId,
          });
          return;
        }

        const clientParty = await this.partyRepository.findById(
          errand.clientPartyId,
        );
        if (!clientParty?.person) {
          this.logger.warn('ChatLifecycleSaga: client party/person not found', {
            errandId,
            clientPartyId: errand.clientPartyId,
          });
          return;
        }

        const participantIds = new Set<string>([
          clientParty.person.userId.value,
        ]);

        for (const assignment of assignments) {
          const providerParty = await this.partyRepository.findById(
            assignment.providerPartyId,
          );
          if (providerParty?.person) {
            participantIds.add(providerParty.person.userId.value);
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
