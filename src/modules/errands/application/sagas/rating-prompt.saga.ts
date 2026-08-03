import { Injectable } from '@nestjs/common';
import { CommandBus, ofType, Saga } from '@nestjs/cqrs';
import { ignoreElements, mergeMap, Observable } from 'rxjs';
import {
  ErrandCompletedEvent,
  IErrandRepository,
} from '@module/errands/domain';
import { IPartyRepository } from '@module/party';
import { SendNotificationCommand } from '@module/notification';
import { ILogger } from '@src/common';
import { PrismaService } from '@src/prisma/prisma.service';

/**
 * Per errand-completion-flow.md's `RatingPromptSaga` spec:
 * - client -> rate org/individual (client-facing)
 * - each assigned member -> rate the org (internal, only when an org is involved)
 * - org -> rate each assigned member (internal, once per distinct org)
 */
@Injectable()
export class RatingPromptSaga {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly partyRepository: IPartyRepository,
    private readonly commandBus: CommandBus,
    private readonly logger: ILogger,
    private readonly prisma: PrismaService,
  ) {}

  @Saga()
  promptRatingsOnErrandCompleted = (
    events$: Observable<any>,
  ): Observable<never> => {
    return events$.pipe(
      ofType(ErrandCompletedEvent),
      mergeMap(async (event: ErrandCompletedEvent) => {
        const { errandId, completedBy } = event.payload;

        const errand = await this.errandRepository.findById(errandId);
        if (!errand) {
          this.logger.warn('RatingPromptSaga: errand not found', {
            errandId,
          });
          return;
        }

        const assignments =
          await this.errandRepository.findAssignmentsByErrandId(errandId);

        // a. client -> rate org/individual
        try {
          const clientParty = await this.partyRepository.findById(
            errand.clientPartyId,
          );
          if (!clientParty?.person) {
            this.logger.warn(
              'RatingPromptSaga: client party/person not found',
              { errandId, clientPartyId: errand.clientPartyId },
            );
          } else {
            const clientUserId = clientParty.person.userId.value;
            const clientUser = await this.prisma.user.findUnique({
              where: { id: clientUserId },
            });

            if (!clientUser?.email) {
              this.logger.warn(
                'RatingPromptSaga: client user/email not found',
                { errandId, clientUserId },
              );
            } else {
              await this.commandBus.execute(
                new SendNotificationCommand({
                  userId: clientUserId,
                  type: 'RATING_PROMPT_CLIENT',
                  channel: 'EMAIL',
                  payload: {
                    to: clientUser.email,
                    subject: 'Rate your errand',
                    template: 'rating-prompt',
                    context: { errandId },
                  },
                }),
              );
            }
          }
        } catch (error) {
          this.logger.warn('RatingPromptSaga: failed to notify client', {
            errandId,
            error: error instanceof Error ? error.message : error,
          });
        }

        // b. each assigned member -> rate the org (only when there IS an org)
        const organizationIdsToNotify = new Set<string>();

        for (const assignment of assignments) {
          if (!assignment.assignedByOrganizationId) {
            continue;
          }

          organizationIdsToNotify.add(assignment.assignedByOrganizationId);

          try {
            const memberParty = await this.partyRepository.findById(
              assignment.providerPartyId,
            );
            if (!memberParty?.person) {
              this.logger.warn(
                'RatingPromptSaga: member party/person not found',
                { errandId, providerPartyId: assignment.providerPartyId },
              );
              continue;
            }

            const memberUserId = memberParty.person.userId.value;
            const memberUser = await this.prisma.user.findUnique({
              where: { id: memberUserId },
            });

            if (!memberUser?.email) {
              this.logger.warn(
                'RatingPromptSaga: member user/email not found',
                { errandId, memberUserId },
              );
              continue;
            }

            await this.commandBus.execute(
              new SendNotificationCommand({
                userId: memberUserId,
                type: 'RATING_PROMPT_MEMBER',
                channel: 'EMAIL',
                payload: {
                  to: memberUser.email,
                  subject: 'Rate your organization',
                  template: 'rating-prompt',
                  context: {
                    errandId,
                    organizationPartyId: assignment.assignedByOrganizationId,
                  },
                },
              }),
            );
          } catch (error) {
            this.logger.warn('RatingPromptSaga: failed to notify member', {
              errandId,
              providerPartyId: assignment.providerPartyId,
              error: error instanceof Error ? error.message : error,
            });
          }
        }

        // c. org -> rate each assigned member (once per distinct org)
        for (const organizationPartyId of organizationIdsToNotify) {
          try {
            const orgParty =
              await this.partyRepository.findById(organizationPartyId);
            if (!orgParty?.organization) {
              this.logger.warn(
                'RatingPromptSaga: organization party not found',
                { errandId, organizationPartyId },
              );
              continue;
            }

            const ownerUserId = orgParty.organization.ownerId.value;
            const ownerUser = await this.prisma.user.findUnique({
              where: { id: ownerUserId },
            });

            if (!ownerUser?.email) {
              this.logger.warn(
                'RatingPromptSaga: org owner user/email not found',
                { errandId, organizationPartyId, ownerUserId },
              );
              continue;
            }

            const memberProfileIds = assignments
              .filter(
                (assignment) =>
                  assignment.assignedByOrganizationId === organizationPartyId,
              )
              .map((assignment) => assignment.providerPartyId);

            await this.commandBus.execute(
              new SendNotificationCommand({
                userId: ownerUserId,
                type: 'RATING_PROMPT_ORG',
                channel: 'EMAIL',
                payload: {
                  to: ownerUser.email,
                  subject: 'Rate your team members',
                  template: 'rating-prompt',
                  context: { errandId, memberProfileIds },
                },
              }),
            );
          } catch (error) {
            this.logger.warn(
              'RatingPromptSaga: failed to notify organization owner',
              {
                errandId,
                organizationPartyId,
                error: error instanceof Error ? error.message : error,
              },
            );
          }
        }

        this.logger.info('RatingPromptSaga: rating prompts dispatched', {
          errandId,
          completedBy,
        });
      }),
      ignoreElements(),
    );
  };
}
