import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { GqlUserRole } from 'src/users/entities/user.entity';

@ObjectType()
export class Wallet {
  @Field(() => ID)
  id: string;

  @Field()
  ownerId: string;

  @Field(() => GqlUserRole)
  ownerType: GqlUserRole;

  @Field(() => Float)
  available: number;

  @Field(() => Float)
  held: number;

  @Field({ nullable: true })
  currency?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
