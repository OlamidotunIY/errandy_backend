import { ObjectType, Field, ID } from '@nestjs/graphql';
import { CircleSource } from './circle-source.enum';
import { Provider } from 'src/provider/entities/provider.entity';
import { TrustedCircleMemberStatus } from './trusted-circle-member-status.enum';

@ObjectType()
export class TrustedCircleMember {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  trustedCircleId: string;

  @Field(() => ID)
  providerId: string;

  @Field()
  addedAt: Date;

  @Field(() => CircleSource)
  source: CircleSource;

  @Field(() => TrustedCircleMemberStatus)
  status: TrustedCircleMemberStatus;

  @Field(() => Provider)
  provider: Provider;
}
