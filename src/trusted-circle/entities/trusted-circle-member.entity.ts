import { ObjectType, Field, ID } from '@nestjs/graphql';
import { CircleSource } from './circle-source.enum';
import { Provider } from 'src/worker/entities/provider.entity';

@ObjectType()
export class TrustedCircleMember {
  @Field(() => ID)
  id: string;

  @Field()
  trustedCircleId: string;

  @Field()
  providerId: string;

  @Field()
  addedAt: Date;

  @Field(() => CircleSource)
  source: CircleSource;

  @Field(() => Provider, { nullable: true })
  provider?: Provider;
}
