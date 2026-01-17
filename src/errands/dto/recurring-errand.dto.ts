import { InputType, Field, ID, PartialType } from '@nestjs/graphql';
import {
  IsEnum,
  IsMongoId,
  IsBoolean,
  IsOptional,
  IsDate,
} from 'class-validator';
import { RecurrenceFrequency } from '../entities/recurrence-frequency.enum';

@InputType()
export class CreateRecurringErrandInput {
  @Field(() => ID)
  @IsMongoId()
  templateId: string;

  @Field(() => RecurrenceFrequency)
  @IsEnum(RecurrenceFrequency)
  frequency: RecurrenceFrequency;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  startDate?: Date;
}

@InputType()
export class UpdateRecurringErrandInput extends PartialType(
  CreateRecurringErrandInput,
) {
  @Field(() => ID)
  @IsMongoId()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@InputType()
export class CancelRecurringErrandInput {
  @Field(() => ID)
  @IsMongoId()
  id: string;
}
