import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetVerificationProfileQuery } from './get-verification-profile.query';
import { IVerificationRepository, VerificationProfileProps } from '../../../domain';

@QueryHandler(GetVerificationProfileQuery)
export class GetVerificationProfileHandler
  implements
    IQueryHandler<GetVerificationProfileQuery, VerificationProfileProps | null>
{
  constructor(
    private readonly verificationRepository: IVerificationRepository,
  ) {}

  async execute(
    query: GetVerificationProfileQuery,
  ): Promise<VerificationProfileProps | null> {
    const profile = await this.verificationRepository.findByPartyId(
      query.partyId,
    );
    if (!profile) return null;
    return profile.toPrimitives();
  }
}
