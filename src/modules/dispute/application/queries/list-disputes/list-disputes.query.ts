import { Query } from '@nestjs/cqrs';
import { DisputeProps, DisputeStatus } from '../../../domain';

export class ListDisputesQuery extends Query<DisputeProps[]> {
  constructor(
    public readonly status?: DisputeStatus,
    public readonly limit: number = 50,
  ) {
    super();
  }
}
