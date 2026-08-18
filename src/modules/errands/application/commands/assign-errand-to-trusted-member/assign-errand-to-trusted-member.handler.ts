import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import {
  AssignErrandToTrustedMemberCommand,
  AssignErrandToTrustedMemberResponseDto,
} from '.';
import {
  Errand,
  ErrandAssignment,
  ErrandInvariantError,
  IErrandRepository,
  SourceType,
} from '@module/errands/domain';
import { Currency, Money } from '@module/escrow/domain';
import { IPartyRepository, PartyId, PartyNotFoundError } from '@module/party';
import {
  Application,
  ApplicationType,
  IApplicationRepository,
} from '@module/application/domain';
import {
  AddressId,
  AddressNotFoundError,
  IAddressRepository,
} from '@module/address';
import { ILogger } from '@src/common';

@CommandHandler(AssignErrandToTrustedMemberCommand)
export class AssignErrandToTrustedMemberHandler implements ICommandHandler<AssignErrandToTrustedMemberCommand> {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly applicationRepository: IApplicationRepository,
    private readonly partyRepository: IPartyRepository,
    private readonly addressRepository: IAddressRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: AssignErrandToTrustedMemberCommand,
  ): Promise<AssignErrandToTrustedMemberResponseDto> {
    const { payload } = command;

    if (!payload.clientPartyId || !payload.offeredToPartyId) {
      throw new ErrandInvariantError('Missing required fields');
    }

    const clientParty = await this.partyRepository.findById(
      payload.clientPartyId,
    );
    if (!clientParty) {
      throw new PartyNotFoundError(payload.clientPartyId);
    }

    const address = await this.addressRepository.findById(
      AddressId.fromString(payload.addressId),
    );
    if (!address) {
      throw new AddressNotFoundError(payload.addressId);
    }
    const location = address.toGeoJson();

    const budget = Money.fromMinorUnits(
      payload.budget.amountMinorUnits,
      payload.budget.currency as Currency,
    );

    const errand = Errand.create(
      payload.clientPartyId,
      payload.categoryId,
      payload.title,
      payload.description,
      payload.addressId,
      location,
      budget,
      clientParty.marketId,
      SourceType.TRUSTED_DIRECT_ASSIGN,
    );

    const application = Application.create(
      errand.id,
      PartyId.fromString(payload.offeredToPartyId),
      'Direct trusted offer',
      payload.budget.amountMinorUnits,
      payload.budget.currency,
      ApplicationType.DIRECT_OFFER,
    );

    // Immediately assign the errand — this is a direct-trusted assignment,
    // no bidding is needed. This fires ErrandAssignedEvent (opens chat thread, etc.)
    errand.assignTo(application.id.value);

    const assignment = ErrandAssignment.create(
      errand.id,
      payload.offeredToPartyId,
    );

    await this.errandRepository.save(errand);
    await this.applicationRepository.save(application);
    await this.errandRepository.saveAssignment(assignment);

    for (const event of [
      ...errand.pullDomainEvents(),
      ...application.pullDomainEvents(),
      ...assignment.pullDomainEvents(),
    ]) {
      this.eventBus.publish(event);
    }

    this.logger.info('Errand created and directly assigned to trusted member', {
      errandId: errand.id.value,
      applicationId: application.id.value,
    });

    return {
      errandId: errand.id.value,
      applicationId: application.id.value,
    };
  }
}
