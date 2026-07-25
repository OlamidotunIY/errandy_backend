import { Injectable } from '@nestjs/common';
import {
  Currency,
  Escrow,
  EscrowId,
  EscrowStatus,
  Money,
} from '@escrow/domain';
import { Prisma, Escrow as PrismaEscrow } from '@prisma/client';
import { ErrandId } from '@errands';
import { ClientId } from '@client';
import { ProviderId } from '@provider';

@Injectable()
export class EscrowMapper {
  toDomain(escrow: PrismaEscrow): Escrow {
    return Escrow.reconstitute({
      id: EscrowId.fromString(escrow.id),
      errandId: ErrandId.fromString(escrow.errandId),
      clientId: ClientId.fromString(escrow.clientId),
      workerId: ProviderId.fromString(escrow.workerId),
      amountGross: Money.fromKobo(
        escrow.amountGross,
        escrow.currency as Currency,
      ),
      platformFee: Money.fromKobo(
        escrow.platformFee,
        escrow.currency as Currency,
      ),
      amountNetWorker: Money.fromKobo(
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
      clientId: escrow.clientId.toString(),
      workerId: escrow.workerId.toString(),
      amountGross: escrow.amountGross.toKobo(),
      platformFee: escrow.platformFee.toKobo(),
      amountNetWorker: escrow.amountNetWorker.toKobo(),
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
