import { InputType, Int, Field, Float } from '@nestjs/graphql';
import { IsLatitude, IsLongitude, IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class CreateUserInput {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}

@InputType()
export class CreateAddressInput {
  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  label: string;

  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  address: string;

  @Field(() => Float)
  @IsLatitude()
  latitude: number;

  @Field(() => Float)
  @IsLongitude()
  longitude: number;
}
