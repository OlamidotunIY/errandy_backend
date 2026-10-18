import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { OfferErrandToTrustedMemberCommand } from './offer-errand-to-trusted-member.command';
import { OfferErrandToTrustedMemberResponseDto } from './offer-errand-to-trusted-member.request.dto';
import { ErrandNotFoundError, IErrandRepository } from '@module/errands/domain';
import { ErrandOfferedToTrustedMemberIntegrationEvent, ILogger } from '@src/common';

@CommandHandler(OfferErrandToTrustedMemberCommand)
export class OfferErrandToTrustedMemberHandler implements ICommandHandler<OfferErrandToTrustedMemberCommand> {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: OfferErrandToTrustedMemberCommand,
  ): Promise<OfferErrandToTrustedMemberResponseDto> {
    const { payload } = command;

    const errand = await this.errandRepository.findById(payload.errandId);
    if (!errand) {
      throw new ErrandNotFoundError(payload.errandId);
    }

    const applicationId = crypto.randomUUID();

    this.eventBus.publish(
      new ErrandOfferedToTrustedMemberIntegrationEvent({
        applicationId,
        errandId: payload.errandId,
        offeredToPartyId: payload.offeredToPartyId,
        proposedAmountMinorUnits: payload.proposedAmountMinorUnits,
        currency: payload.currency,
        originType: 'DIRECT_OFFER',
      }),
    );

    this.logger.info('Direct offer published via integration event', {
      errandId: payload.errandId,
      applicationId,
    });

    return { applicationId };
  }
}
