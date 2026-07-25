import { Query } from '@nestjs/cqrs';
import { EscrowDTO, GetEscrowByErrandPayload } from '@escrow/application';

export class GetEscrowByErrandQuery extends Query<EscrowDTO | null> {
  constructor(public readonly payload: GetEscrowByErrandPayload) {
    super();
  }
}
