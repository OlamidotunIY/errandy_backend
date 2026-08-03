import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  SetDefaultPaymentMethodCommand,
  SetDefaultPaymentMethodResponseDto,
} from '@module/party';
import {
  ClientRoleNotFoundError,
  IPartyRepository,
  PartyInvariantError,
  PartyNotFoundError,
} from '@module/party';
import { ILogger } from '@src/common';

@CommandHandler(SetDefaultPaymentMethodCommand)
export class SetDefaultPaymentMethodHandler implements ICommandHandler<SetDefaultPaymentMethodCommand> {
  constructor(
    private readonly partyRepository: IPartyRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: SetDefaultPaymentMethodCommand,
  ): Promise<SetDefaultPaymentMethodResponseDto> {
    const { partyId, paymentMethodId } = command.payload;

    if (!partyId || !paymentMethodId) {
      throw new PartyInvariantError('partyId and paymentMethodId are required');
    }

    const party = await this.partyRepository.findById(partyId);
    if (!party) {
      throw new PartyNotFoundError(partyId);
    }

    if (!party.clientRole) {
      throw new ClientRoleNotFoundError(partyId);
    }

    try {
      party.clientRole.setDefaultPaymentMethod(paymentMethodId);
      await this.partyRepository.save(party);

      this.logger.info('Default payment method set for party', {
        partyId: party.id.value,
        paymentMethodId,
      });

      return {
        partyId: party.id.value,
        defaultPaymentMethodId: paymentMethodId,
      };
    } catch (error) {
      this.logger.error(
        'Failed to set default payment method for party',
        error as Error,
        { partyId, paymentMethodId },
      );
      throw error;
    }
  }
}
