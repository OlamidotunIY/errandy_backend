import { Query } from '@nestjs/cqrs';
import { DisputeProps } from '../../../domain';

export class GetDisputesByErrandQuery extends Query<DisputeProps[]> {
  constructor(public readonly errandId: string) {
    super();
  }
}
