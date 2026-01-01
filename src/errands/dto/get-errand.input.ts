import { InputType, Field, ID } from '@nestjs/graphql';
import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class GetErrandInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  id: string;
}
