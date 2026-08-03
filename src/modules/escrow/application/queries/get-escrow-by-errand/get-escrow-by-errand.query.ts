import { EscrowDTO, GetEscrowByErrandPayload } from '@module/escrow';
import { Query } from '@nestjs/cqrs';

export class GetEscrowByErrandQuery extends Query<EscrowDTO | null> {
  constructor(public readonly payload: GetEscrowByErrandPayload) {
    super();
  }
}
