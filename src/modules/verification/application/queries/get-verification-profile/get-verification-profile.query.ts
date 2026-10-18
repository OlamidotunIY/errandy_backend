import { Query } from '@nestjs/cqrs';
import { VerificationProfileProps } from '../../../domain';

export class GetVerificationProfileQuery extends Query<VerificationProfileProps | null> {
  constructor(public readonly partyId: string) {
    super();
  }
}
