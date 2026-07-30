import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetEscrowByErrandQuery } from './GetEscrowByErrandQuery';
import {
  EscrowDTO,
  EscrowInvariantError,
  EscrowRepository,
} from '@module/escrow';
import { ILogger } from '@src/common';

@QueryHandler(GetEscrowByErrandQuery)
export class GetEscrowByErrandHandler implements IQueryHandler<GetEscrowByErrandQuery> {
  constructor(
    private readonly escrowRepository: EscrowRepository,
    private readonly logger: ILogger,
  ) {}

  async execute(query: GetEscrowByErrandQuery): Promise<EscrowDTO | null> {
    const { payload } = query;

    if (!payload.errandId) {
      this.logger.error('GetEscrowByErrandHandler: errandId is required');
      throw new EscrowInvariantError('errandId is required');
    }

    const escrow = await this.escrowRepository.findByErrandId(payload.errandId);

    if (!escrow) {
      this.logger.error('GetEscrowByErrandHandler: escrow not found');
      throw new EscrowInvariantError('escrow not found');
    }

    return {
      id: escrow.id.value,
      errandId: escrow.errandId.value,
      amountGross: escrow.amountGross.amountKobo,
      platformFee: escrow.platformFee.amountKobo,
      amountNetWorker: escrow.amountNetWorker.amountKobo,
      status: escrow.status,
      clientId: escrow.clientId.value,
      workerId: escrow.workerId.value,
      holdUntil: escrow.holdUntil,
      createdAt: escrow.createdAt,
      updatedAt: escrow.updatedAt,
      completedAt: escrow.completedAt,
      refundedAt: escrow.refundedAt,
      releasedAt: escrow.releasedAt,
    };
  }
}
