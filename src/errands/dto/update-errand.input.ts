import { InputType, Field, Float, PartialType } from '@nestjs/graphql';
import { CreateErrandInput } from './create-errand.input';
import { ErrandStatus } from '../entities/errandStatus.enum';
import { PricingType } from '../entities/pricingType.enum';
import { WorkerType } from '../entities/workerType.enum';
import {
  IsDate,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

@InputType()
export class UpdateErrandInput extends PartialType(CreateErrandInput) {
  @Field(() => String)
  @IsMongoId()
  id: string;

  @Field({ nullable: true, description: 'Errand description' })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  location?: string;

  @Field(() => PricingType, { nullable: true })
  @IsOptional()
  @IsEnum(PricingType)
  pricingType?: PricingType;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @Field(() => ErrandStatus, { nullable: true })
  @IsOptional()
  @IsEnum(ErrandStatus)
  status?: ErrandStatus;

  @Field(() => WorkerType, { nullable: true })
  @IsOptional()
  @IsEnum(WorkerType)
  workerType?: WorkerType;

  @Field({ nullable: true })
  @IsOptional()
  @IsMongoId()
  serviceId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsMongoId()
  assignedTo?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  applicationDeadline?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  completionDeadline?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  serviceAddress?: string;
}

@InputType()
export class UpdateErrandLocation extends PartialType(UpdateErrandInput) {
  @Field(() => Float)
  @IsLatitude()
  latitude: number;

  @Field(() => Float)
  @IsLongitude()
  longitude: number;
}
