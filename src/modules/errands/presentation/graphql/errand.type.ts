import {
  Field,
  Float,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  AssignmentStatus,
  CompletedBy,
  ErrandStatus,
  SourceType,
} from '../../domain';
import {
  BrowseOpenErrandsResponseDto,
  CreateErrandResponseDto,
  ErrandDetailResponseDto,
  ErrandSummaryResponseDto,
  OfferErrandToTrustedMemberResponseDto,
  PublishErrandResponseDto,
  StartErrandResponseDto,
  CompleteErrandResponseDto,
  ConfirmAssignmentCompletionResponseDto,
} from '../../application';

registerEnumType(ErrandStatus, { name: 'ErrandStatus' });
registerEnumType(SourceType, { name: 'SourceType' });
registerEnumType(CompletedBy, { name: 'CompletedBy' });
registerEnumType(AssignmentStatus, { name: 'AssignmentStatus' });

@InputType()
export class ErrandBudgetInput {
  @Field(() => Int)
  amountMinorUnits!: number;

  @Field(() => String)
  currency!: string;
}

@ObjectType()
export class ErrandBudgetType {
  @Field(() => Int)
  amountMinorUnits!: number;

  @Field(() => String)
  currency!: string;
}

@InputType()
export class CreateErrandInput {
  @Field(() => String)
  clientPartyId!: string;

  @Field(() => String)
  categoryId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  description!: string;

  @Field(() => String)
  addressId!: string;

  @Field(() => ErrandBudgetInput)
  budget!: ErrandBudgetInput;
}

@InputType()
export class BrowseOpenErrandsInput {
  @Field(() => String)
  requesterPartyId!: string;

  @Field(() => String, { nullable: true })
  categoryId?: string;

  @Field(() => Float)
  latitude!: number;

  @Field(() => Float)
  longitude!: number;

  @Field(() => Float, { nullable: true })
  radiusMeters?: number;

  @Field(() => Int, { defaultValue: 20 })
  limit = 20;

  @Field(() => String, { nullable: true })
  cursor?: string;
}

@ObjectType()
export class ErrandSummaryType implements ErrandSummaryResponseDto {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  categoryId!: string;

  @Field(() => ErrandBudgetType)
  budget!: ErrandBudgetType;

  @Field(() => Float)
  distanceMeters!: number;

  @Field(() => String)
  createdAt!: string;
}

@ObjectType()
export class BrowseOpenErrandsResponseType
  implements BrowseOpenErrandsResponseDto
{
  @Field(() => [ErrandSummaryType])
  items!: ErrandSummaryType[];
}

@ObjectType()
export class ErrandDetailType implements ErrandDetailResponseDto {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  clientPartyId!: string;

  @Field(() => String)
  categoryId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  description!: string;

  @Field(() => String)
  addressId!: string;

  @Field(() => ErrandBudgetType)
  budget!: ErrandBudgetType;

  @Field(() => String)
  status!: string;

  @Field(() => String)
  sourceType!: string;

  @Field(() => String)
  requiredTier!: string;

  @Field(() => String)
  marketId!: string;

  @Field(() => String, { nullable: true })
  startedAt?: string;

  @Field(() => String, { nullable: true })
  completedAt?: string;

  @Field(() => String)
  createdAt!: string;
}

@ObjectType()
export class ErrandOperationResultType
  implements
    CreateErrandResponseDto,
    PublishErrandResponseDto,
    StartErrandResponseDto,
    CompleteErrandResponseDto
{
  @Field(() => String)
  errandId!: string;

  @Field(() => String)
  status!: string;
}

@ObjectType()
export class ConfirmAssignmentCompletionType
  implements ConfirmAssignmentCompletionResponseDto
{
  @Field(() => String)
  errandAssignmentId!: string;

  @Field(() => String)
  status!: string;

  @Field(() => Boolean)
  errandReadyForCompletion!: boolean;
}

@ObjectType()
export class OfferErrandResultType
  implements OfferErrandToTrustedMemberResponseDto
{
  @Field(() => String)
  applicationId!: string;
}
