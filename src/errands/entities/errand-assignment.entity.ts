import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { Errand } from './errand.entity';

export enum AssignmentRole {
  LEAD = 'LEAD',
  MEMBER = 'MEMBER',
}

registerEnumType(AssignmentRole, {
  name: 'AssignmentRole',
});

export enum AssignmentStatus {
  ASSIGNED = 'ASSIGNED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

registerEnumType(AssignmentStatus, {
  name: 'AssignmentStatus',
});

@ObjectType()
export class ErrandAssignment {
  @Field(() => ID)
  id: string;

  @Field()
  errandId: string;

  @Field()
  providerOrgId: string;

  @Field({ nullable: true })
  workerId?: string;

  @Field(() => AssignmentRole)
  role: AssignmentRole;

  @Field(() => AssignmentStatus)
  status: AssignmentStatus;

  @Field()
  assignedAt: Date;

  @Field(() => Errand)
  errand: Errand;
}
