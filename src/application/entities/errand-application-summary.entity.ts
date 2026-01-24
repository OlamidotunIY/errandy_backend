import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ApplicationStatus } from './applicationStatus.enum';

@ObjectType()
export class ErrandApplicationSummary {
  @Field(() => Int)
  totalApplications: number;

  @Field(() => Int)
  pendingApplications: number;

  @Field(() => Int)
  acceptedApplications: number;

  @Field(() => Int)
  cancelledApplications: number;

  @Field(() => Int)
  rejectedApplications: number;

  @Field(() => Int)
  chattingApplicants: number;

  @Field(() => ApplicationStatus, { nullable: true })
  myApplicationStatus?: ApplicationStatus;
}

