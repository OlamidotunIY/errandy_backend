import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Provider } from 'src/provider/entities/provider.entity';
import { OrgMember } from './org-member.entity';

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

  @Field(() => [OrgMember], { nullable: 'itemsAndList' })
  members?: OrgMember[];
}
