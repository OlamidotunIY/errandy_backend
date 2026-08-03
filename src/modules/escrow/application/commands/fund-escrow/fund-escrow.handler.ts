import { FundEscrowResult } from './fund-escrow.result';
import { CommandHandler, EventBus } from '@nestjs/cqrs';
import { FundEscrowCommand } from './';
import {
  Escrow,
  EscrowInvariantError,
  EscrowRepository,
} from '@module/escrow/domain';
import { ILogger } from '@src/common';

@CommandHandler(FundEscrowCommand)
class FundEscrowHandler {
  constructor(
    private readonly escrowRepository: EscrowRepository,
    private readonly logger: ILogger,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: FundEscrowCommand): Promise<FundEscrowResult> {
    const { payload } = command;
    this.logger.info(
      `Executing FundEscrowCommand with payload: ${JSON.stringify(payload)}`,
    );

    if (
      !payload.errandId ||
      !payload.amountGross ||
      !payload.clientPartyId ||
      !payload.providerPartyId ||
      !payload.paymentMethodId ||
      !payload.platformFeeRate
    ) {
      throw new EscrowInvariantError('Missing required payload fields');
    }

    const escrow = Escrow.create(
      payload.errandId,
      payload.clientPartyId,
      payload.providerPartyId,
      payload.amountGross,
      payload.platformFeeRate,
    );

    escrow.fund(payload.correlationId);

    await this.escrowRepository.save(escrow);

    // Publish domain events
    const events = escrow.pullDomainEvents();
    for (const event of events) {
      this.eventBus.publish(event);
    }

    const result: FundEscrowResult = {
      escrowId: escrow.id.value,
      amountGross: escrow.amountGross.toMinorUnits(),
      platformFee: escrow.platformFee.toMinorUnits(),
      amountNetWorker: escrow.amountNetWorker.toMinorUnits(),
    };

    this.logger.info(
      `FundEscrowCommand executed successfully with result: ${JSON.stringify(
        result,
      )}`,
    );

    return result;
  }
}

export { FundEscrowHandler };
