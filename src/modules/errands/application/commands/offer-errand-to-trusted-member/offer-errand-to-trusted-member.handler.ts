import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import {
  OfferErrandToTrustedMemberCommand,
  OfferErrandToTrustedMemberResponseDto,
} from '.';
import { ErrandNotFoundError, IErrandRepository } from '@module/errands/domain';
import { PartyId } from '@module/party';
import {
  Application,
  ApplicationType,
  IApplicationRepository,
} from '@module/application/domain';
import { ILogger } from '@src/common';

@CommandHandler(OfferErrandToTrustedMemberCommand)
export class OfferErrandToTrustedMemberHandler implements ICommandHandler<OfferErrandToTrustedMemberCommand> {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly applicationRepository: IApplicationRepository,
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

    const application = Application.create(
      errand.id,
      PartyId.fromString(payload.offeredToPartyId),
      'Direct trusted offer',
      payload.proposedAmountMinorUnits,
      payload.currency,
      ApplicationType.DIRECT_OFFER,
    );

    await this.applicationRepository.save(application);

    for (const event of application.pullDomainEvents()) {
      this.eventBus.publish(event);
    }

    this.logger.info('Direct offer created for existing errand', {
      errandId: payload.errandId,
      applicationId: application.id.value,
    });

    return { applicationId: application.id.value };
  }
}
