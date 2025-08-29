import { InputType, Int, Field, Float } from '@nestjs/graphql';
import { GeoPoint } from '../entities/user-address.entities';
import { IsLatitude, IsLongitude } from 'class-validator';

@InputType()
export class CreateUserInput {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}

@InputType()
export class CreateAddressInput {
  @Field(() => String)
  userId: string;

  @Field(() => String)
  label: string;

  @Field(() => String)
  address: string;

  @Field(() => Float)
  @IsLatitude()
  latitude: number;

  @Field(() => Float)
  @IsLongitude()
  longitude: number;
}
