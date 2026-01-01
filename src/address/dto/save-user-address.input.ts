import { InputType, Field, Float } from '@nestjs/graphql';
import { IsLatitude, IsLongitude, IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class SaveUserAddressInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  label: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  address: string;

  @Field(() => Float)
  @IsLatitude()
  @IsNotEmpty()
  latitude: number;

  @Field(() => Float)
  @IsLongitude()
  @IsNotEmpty()
  longitude: number;
}
