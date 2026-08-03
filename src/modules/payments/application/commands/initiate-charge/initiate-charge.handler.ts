import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import * as crypto from 'node:crypto';
import {
  InitiateChargeCommand,
  IPaymentGatewayAdapter,
  IPaymentMethodRepository,
  IPaymentTransactionRepository,
  InitiateChargeResponseDto,
  PaymentTransaction,
  ChargeFailedError,
} from '../../../';
import { IPartyRepository, PartyId } from '@module/party';
import { ErrandId } from '@module/errands';
import { Money } from '@module/escrow';
import { ILogger } from '@src/common';
import { IUserRepository } from '@module/user';

@CommandHandler(InitiateChargeCommand)
export class InitiateChargeHandler implements ICommandHandler<InitiateChargeCommand> {
  constructor(
    private readonly gateway: IPaymentGatewayAdapter,
    private readonly paymentMethod: IPaymentMethodRepository,
    private readonly transactionRepository: IPaymentTransactionRepository,
    private readonly userRepo: IUserRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly eventBus: EventBus,
    private readonly logger: ILogger,
  ) {}

  async execute(
    command: InitiateChargeCommand,
  ): Promise<InitiateChargeResponseDto> {
    const { amount, purposeId, paymentMethodId, clientPartyId } =
      command.payload;

    this.logger.info('Initiating charge transaction', {
      clientPartyId,
      purposeId,
      amount,
      paymentMethodId,
    });

    // 1. Get the party details to find the userId
    const partyRow = await this.partyRepo.findById(clientPartyId);

    if (!partyRow) {
      throw new Error(`Party not found: ${clientPartyId}`);
    }

    const userId = partyRow.person?.userId || partyRow.organization?.ownerId;
    if (!userId) {
      throw new Error(`User ID not found for party: ${clientPartyId}`);
    }

    // 2. Get the user email
    const userRow = await this.userRepo.findById(userId.toString());

    if (!userRow?.email) {
      throw new Error(`Email not found for user: ${userId.toString()}`);
    }

    const email = userRow.email;

    // 3. Find payment method
    const method = await this.paymentMethod.findById(paymentMethodId);
    if (!method) {
      throw new Error(`Payment method not found: ${paymentMethodId}`);
    }

    if (method.partyId !== clientPartyId) {
      throw new Error(`Payment method does not belong to client`);
    }

    // 4. Create and save the pending payment transaction
    const money = Money.fromMinorUnits(amount, 'NGN');

    const transaction = PaymentTransaction.initiate(
      PartyId.fromString(clientPartyId),
      ErrandId.fromString(purposeId),
      money,
      method.id,
    );

    await this.transactionRepository.save(transaction);

    // 5. Charge the authorization code
    const chargeResult = await this.gateway.chargeAuthorization(
      email,
      method.providerRef,
      money.amountMinorUnits,
      money.currency,
      transaction.id.toString(),
    );

    // 6. Handle charge result and publish events
    if (chargeResult.success) {
      const correlationId = crypto.randomUUID();
      transaction.markSucceeded(chargeResult.gatewayReference, correlationId);
      await this.transactionRepository.save(transaction);

      return {
        gatewayReference: chargeResult.gatewayReference,
      };
    } else {
      const reason = chargeResult.failureReason || 'Charge failed';
      transaction.markFailed(reason, chargeResult.gatewayReference);
      await this.transactionRepository.save(transaction);

      throw new ChargeFailedError(reason);
    }
  }
}
