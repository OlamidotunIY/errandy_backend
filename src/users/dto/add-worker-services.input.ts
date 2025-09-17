import { InputType, Field, ID } from '@nestjs/graphql';
import { IsArray, ArrayNotEmpty, IsUUID, IsOptional } from 'class-validator';

@InputType()
export class AddWorkerServicesInput {
  @Field(() => [ID])
  @IsArray()
  @ArrayNotEmpty()
  serviceIds: string[];
}
