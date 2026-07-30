import {
  Escrow,
  EscrowInvariantError,
  EscrowRepository,
} from 'src/modules/escrow/domain';
import { ILogger } from '@shared';
import { FundEscrowResult } from './FundEscrowResult';
import { CommandHandler, EventBus } from '@nestjs/cqrs';
import { FundEscrowCommand } from '.';

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
      !payload.clientId ||
      !payload.workerId ||
      !payload.paymentMethodId ||
      !payload.platformFeeRate
    ) {
      throw new EscrowInvariantError('Missing required payload fields');
    }

    const escrow = Escrow.create(
      payload.errandId,
      payload.clientId,
      payload.workerId,
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
      amountGross: escrow.amountGross.amountKobo,
      platformFee: escrow.platformFee.amountKobo,
      amountNetWorker: escrow.amountNetWorker.amountKobo,
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
