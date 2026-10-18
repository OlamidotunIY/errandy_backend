import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { AssignErrandToTrustedMemberCommand } from './assign-errand-to-trusted-member.command';
import { AssignErrandToTrustedMemberResponseDto } from './assign-errand-to-trusted-member.request.dto';
import {
  Errand,
  ErrandAssignment,
  ErrandInvariantError,
  IErrandRepository,
  SourceType,
} from '@module/errands/domain';
import { Currency, Money } from '@module/escrow/domain';
import {
  ErrandDirectlyAssignedIntegrationEvent,
  IAddressReadPort,
  ILogger,
  IPartyReadPort,
  ReferenceNotFoundError,
} from '@src/common';

@CommandHandler(AssignErrandToTrustedMemberCommand)
export class AssignErrandToTrustedMemberHandler implements ICommandHandler<AssignErrandToTrustedMemberCommand> {
  constructor(
    private readonly errandRepository: IErrandRepository,
    private readonly partyReadPort: IPartyReadPort,
    private readonly addressReadPort: IAddressReadPort,
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

    const clientParty = await this.partyReadPort.findById(
      payload.clientPartyId,
    );
    if (!clientParty) {
      throw new ReferenceNotFoundError('Party', payload.clientPartyId);
    }

    const location = await this.addressReadPort.findLocationById(
      payload.addressId,
    );
    if (!location) {
      throw new ReferenceNotFoundError('Address', payload.addressId);
    }

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

    const applicationId = crypto.randomUUID();

    // Immediately assign the errand — this is a direct-trusted assignment,
    // no bidding is needed. This fires ErrandAssignedEvent (opens chat thread, etc.)
    errand.assignTo(applicationId);

    const assignment = ErrandAssignment.create(
      errand.id,
      payload.offeredToPartyId,
    );

    await this.errandRepository.save(errand);
    await this.errandRepository.saveAssignment(assignment);

    // Notify ApplicationModule to create the corresponding DIRECT_OFFER Application aggregate
    this.eventBus.publish(
      new ErrandDirectlyAssignedIntegrationEvent({
        applicationId,
        errandId: errand.id.value,
        offeredToPartyId: payload.offeredToPartyId,
        proposedAmountMinorUnits: payload.budget.amountMinorUnits,
        currency: payload.budget.currency,
      }),
    );

    for (const event of [
      ...errand.pullDomainEvents(),
      ...assignment.pullDomainEvents(),
    ]) {
      this.eventBus.publish(event);
    }

    this.logger.info('Errand created and directly assigned to trusted member', {
      errandId: errand.id.value,
      applicationId,
    });

    return {
      errandId: errand.id.value,
      applicationId,
    };
  }
}
