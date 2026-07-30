import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

@InputType()
export class AcceptApplicationInput {
  @Field(() => ID)
  @IsString()
  applicationId: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}

