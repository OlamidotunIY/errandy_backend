import { EscrowDTO, GetEscrowByErrandPayload } from './get-escrow-by-errand.query.payload';
import { Query } from '@nestjs/cqrs';

export class GetEscrowByErrandQuery extends Query<EscrowDTO | null> {
  constructor(public readonly payload: GetEscrowByErrandPayload) {
    super();
  }
}
