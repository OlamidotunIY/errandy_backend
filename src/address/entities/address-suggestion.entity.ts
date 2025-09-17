import { ObjectType, Field, Float } from '@nestjs/graphql';

@ObjectType()
export class AddressSuggestion {
  @Field()
  description: string;

  @Field()
  placeId: string;
}

@ObjectType()
export class AddressDetails {
  @Field()
  formattedAddress: string;

  @Field(() => Float)
  latitude: number;

  @Field(() => Float)
  longitude: number;
}
