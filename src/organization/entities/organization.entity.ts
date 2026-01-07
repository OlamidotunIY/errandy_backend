import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Provider } from 'src/worker/entities/provider.entity';

@ObjectType()
export class Organization {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  logo?: string;

  @Field()
  ownerId: string;

  @Field(() => Provider, { nullable: true })
  owner?: Provider;
}
