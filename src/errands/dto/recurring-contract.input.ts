import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsEnum } from 'class-validator';

export enum RecurrenceFrequency {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

@InputType()
export class CreateRecurringContractInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @Field(() => RecurrenceFrequency)
  @IsEnum(RecurrenceFrequency)
  @IsNotEmpty()
  frequency: RecurrenceFrequency;
}

@InputType()
export class HireFromListingInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  templateId: string;
}
