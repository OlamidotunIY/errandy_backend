import { InputType, Field, Float, PartialType } from '@nestjs/graphql';
import { CreateErrandInput } from './create-errand.input';
import { ErrandStatus } from '../entities/errandStatus.enum';
import { PricingType } from '../entities/pricingType.enum';
import { WorkerType } from '../entities/workerType.enum';
import { IsLatitude, IsLongitude } from 'class-validator';

@InputType()
export class UpdateErrandInput extends PartialType(CreateErrandInput) {
  @Field(() => String)
  id: string;

  @Field({ nullable: true, description: 'Errand description' })
  description?: string;

  @Field({ nullable: true })
  location?: string;

  @Field(() => PricingType, { nullable: true })
  pricingType?: PricingType;

  @Field(() => Float, { nullable: true })
  price?: number;

  @Field(() => Float, { nullable: true })
  hourlyRate?: number;

  @Field(() => ErrandStatus, { nullable: true })
  status?: ErrandStatus;

  @Field(() => WorkerType, { nullable: true })
  workerType?: WorkerType;

  @Field({ nullable: true })
  profession?: string;

  @Field({ nullable: true })
  service?: string;

  @Field({ nullable: true })
  assignedTo?: string;

  @Field({ nullable: true })
  applicationDeadline?: Date;

  @Field({ nullable: true })
  completionDeadline?: Date;

  @Field({ nullable: true })
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
