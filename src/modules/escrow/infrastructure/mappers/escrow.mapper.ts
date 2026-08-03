import { PartyId } from '@module/party';
import { Injectable } from '@nestjs/common';
import {
  Currency,
  Escrow,
  EscrowId,
  EscrowStatus,
  Money,
} from '@module/escrow';
import { Prisma, Escrow as PrismaEscrow } from '@prisma/client';
import { ErrandId } from '@module/errands';

@Injectable()
export class EscrowMapper {
  toDomain(escrow: PrismaEscrow): Escrow {
    return Escrow.reconstitute({
      id: EscrowId.fromString(escrow.id),
      errandId: ErrandId.fromString(escrow.errandId),
      clientId: PartyId.fromString(escrow.clientPartyId),
      workerId: PartyId.fromString(escrow.providerPartyId),
      amountGross: Money.fromMinorUnits(
        escrow.amountGross,
        escrow.currency as Currency,
      ),
      platformFee: Money.fromMinorUnits(
        escrow.platformFee,
        escrow.currency as Currency,
      ),
      amountNetWorker: Money.fromMinorUnits(
        escrow.amountNetWorker,
        escrow.currency as Currency,
      ),
      status: escrow.status as EscrowStatus,
      holdUntil: escrow.holdUntil,
      releasedAt: escrow.releasedAt,
      refundedAt: escrow.refundedAt,
      completedAt: escrow.completedAt,
      createdAt: escrow.createdAt,
      updatedAt: escrow.updatedAt,
    });
  }

  toPersistence(escrow: Escrow): Prisma.EscrowCreateInput {
    return {
      id: escrow.id.toString(),
      errandId: escrow.errandId.toString(),
      clientPartyId: escrow.clientId.toString(),
      providerPartyId: escrow.workerId.toString(),
      amountGross: escrow.amountGross.toMinorUnits(),
      platformFee: escrow.platformFee.toMinorUnits(),
      amountNetWorker: escrow.amountNetWorker.toMinorUnits(),
      currency: escrow.amountGross.currency,
      status: escrow.status,
      holdUntil: escrow.holdUntil,
      releasedAt: escrow.releasedAt,
      refundedAt: escrow.refundedAt,
      completedAt: escrow.completedAt,
      createdAt: escrow.createdAt,
      updatedAt: escrow.updatedAt,
    };
  }
}
