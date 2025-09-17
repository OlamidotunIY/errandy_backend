import { InputType, Field, Float } from '@nestjs/graphql';
import { IsLatitude, IsLongitude } from 'class-validator';

@InputType()
export class ReverseGeocodeInput {
  @Field(() => Float)
  @IsLatitude()
  latitude: number;

  @Field(() => Float)
  @IsLongitude()
  longitude: number;
}
