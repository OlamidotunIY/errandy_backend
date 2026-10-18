import { Query } from '@nestjs/cqrs';
import { TrustedCircleProps } from '../../../domain';

export class GetTrustedCircleQuery extends Query<TrustedCircleProps | null> {
  constructor(public readonly ownerPartyId: string) {
    super();
  }
}
