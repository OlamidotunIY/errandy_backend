import { Query } from '@nestjs/cqrs';
import { DisputeProps } from '../../../domain';

export class GetDisputeByIdQuery extends Query<DisputeProps | null> {
  constructor(public readonly id: string) {
    super();
  }
}
