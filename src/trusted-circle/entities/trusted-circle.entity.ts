import { ObjectType, Field, ID } from '@nestjs/graphql';
import Client from 'src/client/entities/client.entities';
import { TrustedCircleMember } from './trusted-circle-member.entity';

@ObjectType()
export class TrustedCircle {
  @Field(() => ID)
  id: string;

  @Field()
  clientId: string;

  @Field({ nullable: true })
  name?: string;

  @Field()
  createdAt: Date;

  @Field(() => Client, { nullable: true })
  client?: Client;

  @Field(() => [TrustedCircleMember], { nullable: 'itemsAndList' })
  members?: TrustedCircleMember[];
}
