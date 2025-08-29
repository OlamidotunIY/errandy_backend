import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class GeoPoint {
  @Field()
  type: string; // always "Point"

  @Field(() => [Float])
  coordinates: number[]; // [longitude, latitude]
}

@ObjectType()
export class UserAddress {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  userId: string;

  @Field(() => String)
  label: string;

  @Field(() => String)
  address: string;

  @Field(() => GeoPoint)
  location: GeoPoint;
}
