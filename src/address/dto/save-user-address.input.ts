import { InputType, Field, Float } from '@nestjs/graphql';
import { IsLatitude, IsLongitude, IsString } from 'class-validator';

@InputType()
export class SaveUserAddressInput {
  @Field()
  @IsString()
  label: string;

  @Field()
  @IsString()
  address: string;

  @Field(() => Float)
  @IsLatitude()
  latitude: number;

  @Field(() => Float)
  @IsLongitude()
  longitude: number;
}
