import { Injectable } from '@nestjs/common';
import {
  PaymentTransaction as PrismaPaymentTransaction,
  PaymentMethod as PrismaPaymentMethod,
  Prisma,
} from '@prisma/client';
import {
  PaymentTransaction,
  PaymentMethod,
  PaymentTransactionId,
  PaymentMethodId,
  PaymentStatus,
  GatewayReference,
  PaymentMethodType,
} from '../../domain';
import { PartyId } from '@module/party';
import { ErrandId } from '@module/errands';
import { Currency, Money } from '@module/escrow/domain';

@Injectable()
export class PaymentMapper {
  toTransactionDomain(record: PrismaPaymentTransaction): PaymentTransaction {
    const money = Money.fromMinorUnits(
      record.amount.amountMinorUnits,
      record.amount.currency as Currency,
    );

    return PaymentTransaction.reconstitute({
      id: PaymentTransactionId.fromString(record.id),
      clientPartyId: PartyId.fromString(record.clientPartyId),
      purposeId: ErrandId.fromString(record.purposeId),
      amount: money,
      status: (record.status as PaymentStatus) ?? PaymentStatus.PENDING,
      gatewayReference: record.gatewayReference
        ? GatewayReference.create(record.gatewayReference)
        : null,
      method: record.method
        ? PaymentMethodId.fromString(record.method)
        : null,
      failureReason: record.failureReason,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  toTransactionPersistence(
    tx: PaymentTransaction,
  ): Prisma.PaymentTransactionUncheckedCreateInput {
    return {
      id: tx.id.toString(),
      clientPartyId: tx.clientPartyId.toString(),
      purposeId: tx.purposeId.toString(),
      amount: {
        amountMinorUnits: tx.getAmount.amountMinorUnits,
        currency: tx.getAmount.currency,
      },
      status: tx.status,
      direction: 'CHARGE',
      gatewayReference: tx.gatewayReference?.value ?? null,
      method: tx.method?.toString() ?? null,
      failureReason: tx.failureReason,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    };
  }

  toMethodDomain(record: PrismaPaymentMethod): PaymentMethod {
    return PaymentMethod.reconstitute({
      id: PaymentMethodId.fromString(record.id),
      partyId: record.partyId,
      provider: record.provider,
      providerRef: record.providerRef,
      type: record.type as PaymentMethodType,
      cardBrand: record.cardBrand ?? undefined,
      last4: record.last4 ?? undefined,
      expMonth: record.expMonth ?? undefined,
      expYear: record.expYear ?? undefined,
      isDefault: record.isDefault,
      verified: record.verified,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  toMethodPersistence(
    method: PaymentMethod,
  ): Prisma.PaymentMethodUncheckedCreateInput {
    return {
      id: method.id.value,
      partyId: method.partyId,
      provider: method.provider,
      providerRef: method.providerRef,
      type: method.type,
      cardBrand: method.cardBrand ?? null,
      last4: method.last4 ?? null,
      expMonth: method.expMonth ?? null,
      expYear: method.expYear ?? null,
      isDefault: method.isDefault,
      verified: method.verified,
      isActive: method.isActive,
      createdAt: method.createdAt,
      updatedAt: method.updatedAt,
    };
  }
}
