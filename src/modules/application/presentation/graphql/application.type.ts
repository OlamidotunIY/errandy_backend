import {
  Field,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { ApplicationStatus, ApplicationType } from '../../domain';
import { ApplicationDto } from '../../application';

registerEnumType(ApplicationStatus, { name: 'ApplicationStatus' });
registerEnumType(ApplicationType, { name: 'ApplicationType' });

@ObjectType()
export class ApplicationGraphQLType implements ApplicationDto {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  errandId!: string;

  @Field(() => String)
  providerPartyId!: string;

  @Field(() => ApplicationStatus)
  status!: ApplicationStatus;

  @Field(() => ApplicationType)
  type!: ApplicationType;

  @Field(() => String)
  proposal!: string;

  @Field(() => Int)
  proposedAmountMinorUnits!: number;

  @Field(() => String)
  currency!: string;

  @Field(() => Date, { nullable: true })
  acceptedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  rejectedAt?: Date | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class SubmitApplicationInput {
  @Field(() => String)
  errandId!: string;

  @Field(() => String)
  providerPartyId!: string;

  @Field(() => String)
  proposal!: string;

  @Field(() => Int)
  proposedAmountMinorUnits!: number;

  @Field(() => String)
  currency!: string;

  @Field(() => ApplicationType, { defaultValue: ApplicationType.PROVIDER })
  applicantType: ApplicationType = ApplicationType.PROVIDER;
}

@InputType()
export class RequestApplicationAcceptanceInput {
  @Field(() => String)
  clientPartyId!: string;

  @Field(() => String)
  applicationId!: string;

  @Field(() => String)
  paymentMethodId!: string;
}

@ObjectType()
export class ApplicationOperationResultType {
  @Field(() => String)
  id!: string;

  @Field(() => Boolean)
  success!: boolean;
}
