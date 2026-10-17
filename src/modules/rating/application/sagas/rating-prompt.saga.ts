import { Injectable } from '@nestjs/common';
import { EventBus, ofType, Saga } from '@nestjs/cqrs';
import { ignoreElements, mergeMap, Observable } from 'rxjs';
import { ErrandCompletedEvent } from '@module/errands/domain';
import {
  IErrandReadPort,
  ILogger,
  IPartyReadPort,
  IUserReadPort,
  NotificationRequestedEvent,
} from '@src/common';

@Injectable()
export class RatingPromptSaga {
  constructor(
    private readonly errandReadPort: IErrandReadPort,
    private readonly partyReadPort: IPartyReadPort,
    private readonly userReadPort: IUserReadPort,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  @Saga()
  promptRatingsOnErrandCompleted = (
    events$: Observable<any>,
  ): Observable<never> => {
    return events$.pipe(
      ofType(ErrandCompletedEvent),
      mergeMap(async (event: ErrandCompletedEvent) => {
        const { errandId } = event.payload;

        const errand = await this.errandReadPort.findById(errandId);
        if (!errand) {
          this.logger.warn('RatingPromptSaga: errand not found', {
            errandId,
          });
          return;
        }

        const assignments =
          await this.errandReadPort.findAssignmentsByErrandId(errandId);

        // a. client -> rate org/individual
        try {
          const clientParty = await this.partyReadPort.findById(
            errand.clientPartyId,
          );
          if (!clientParty?.personUserId) {
            this.logger.warn(
              'RatingPromptSaga: client party/person not found',
              { errandId, clientPartyId: errand.clientPartyId },
            );
          } else {
            const clientUserId = clientParty.personUserId;
            const clientUser = await this.userReadPort.findById(clientUserId);
            const clientEmail = clientUser?.email;

            if (!clientEmail) {
              this.logger.warn(
                'RatingPromptSaga: client user/email not found',
                { errandId, clientUserId },
              );
            } else {
              this.eventBus.publish(
                new NotificationRequestedEvent({
                  userId: clientUserId,
                  type: 'RATING_PROMPT_CLIENT',
                  channel: 'EMAIL',
                  payload: {
                    to: clientEmail,
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
            const memberParty = await this.partyReadPort.findById(
              assignment.providerPartyId,
            );
            if (!memberParty?.personUserId) {
              this.logger.warn(
                'RatingPromptSaga: member party/person not found',
                { errandId, providerPartyId: assignment.providerPartyId },
              );
              continue;
            }

            const memberUserId = memberParty.personUserId;
            const memberUser = await this.userReadPort.findById(memberUserId);
            const memberEmail = memberUser?.email;

            if (!memberEmail) {
              this.logger.warn(
                'RatingPromptSaga: member user/email not found',
                { errandId, memberUserId },
              );
              continue;
            }

            this.eventBus.publish(
              new NotificationRequestedEvent({
                userId: memberUserId,
                type: 'RATING_PROMPT_MEMBER',
                channel: 'EMAIL',
                payload: {
                  to: memberEmail,
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

        // c. org -> rate each assigned member
        for (const organizationPartyId of organizationIdsToNotify) {
          try {
            const orgParty = await this.partyReadPort.findById(organizationPartyId);
            if (!orgParty?.organizationOwnerUserId) {
              this.logger.warn('RatingPromptSaga: org party/owner not found', {
                errandId,
                organizationPartyId,
              });
              continue;
            }

            const orgOwnerUserId = orgParty.organizationOwnerUserId;
            const orgUser = await this.userReadPort.findById(orgOwnerUserId);
            const orgEmail = orgUser?.email;

            if (!orgEmail) {
              this.logger.warn('RatingPromptSaga: org owner user/email not found', {
                errandId,
                orgOwnerUserId,
              });
              continue;
            }

            const orgMemberAssignments = assignments.filter(
              (a) => a.assignedByOrganizationId === organizationPartyId,
            );

            this.eventBus.publish(
              new NotificationRequestedEvent({
                userId: orgOwnerUserId,
                type: 'RATING_PROMPT_ORG',
                channel: 'EMAIL',
                payload: {
                  to: orgEmail,
                  subject: 'Rate your assigned team members',
                  template: 'rating-prompt-org',
                  context: {
                    errandId,
                    memberPartyIds: orgMemberAssignments.map(
                      (a) => a.providerPartyId,
                    ),
                  },
                },
              }),
            );
          } catch (error) {
            this.logger.warn('RatingPromptSaga: failed to notify organization', {
              errandId,
              organizationPartyId,
              error: error instanceof Error ? error.message : error,
            });
          }
        }
      }),
      ignoreElements(),
    );
  };
}
