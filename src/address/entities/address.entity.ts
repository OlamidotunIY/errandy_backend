import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { User } from 'src/users/entities/user.entity';
// import { GraphQLJSONObject } from 'graphql-type-json'; // If needed later for flexible JSON

@ObjectType()
export class GeoPoint {
  @Field(() => String)
  type: string;

  @Field(() => [Float])
  coordinates: number[];
}

@ObjectType()
export class UserAddress {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  label: string;

  @Field()
  address: string;

  @Field(() => GeoPoint)
  location: GeoPoint;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field(() => [User], { nullable: true })
  activeFor?: User[];
}
