import { InputType, Field } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class PlaceDetailsInput {
  @Field()
  @IsString()
  placeId: string;
}
