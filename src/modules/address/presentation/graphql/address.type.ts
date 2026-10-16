import { Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';

@InputType()
export class CoordinatesInput {
  @Field(() => Float)
  latitude!: number;

  @Field(() => Float)
  longitude!: number;
}

@ObjectType()
export class AddressCoordinatesGraphQLType {
  @Field(() => Float)
  latitude!: number;

  @Field(() => Float)
  longitude!: number;
}

@InputType()
export class CreateAddressInput {
  @Field()
  label!: string;

  @Field()
  street!: string;

  @Field()
  city!: string;

  @Field()
  state!: string;

  @Field()
  country!: string;

  @Field(() => CoordinatesInput)
  coordinates!: CoordinatesInput;
}

@ObjectType()
export class AddressGraphQLType {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  @Field()
  label!: string;

  @Field()
  street!: string;

  @Field()
  city!: string;

  @Field()
  state!: string;

  @Field()
  country!: string;

  @Field(() => Boolean)
  isDefault!: boolean;

  @Field(() => AddressCoordinatesGraphQLType, { nullable: true })
  coordinates?: AddressCoordinatesGraphQLType;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}
