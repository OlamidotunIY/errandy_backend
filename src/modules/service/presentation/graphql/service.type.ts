import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import {
  ListServiceResponseDto,
  ServiceResponseDto,
  UpdateServicePriceResponseDto,
  DeactivateServiceResponseDto,
} from '../../application';

@InputType()
export class ServicePriceInput {
  @Field(() => Number)
  amountMinorUnits!: number;

  @Field(() => String)
  currency!: string;
}

@ObjectType()
export class ServicePriceType {
  @Field(() => Number)
  amountMinorUnits!: number;

  @Field(() => String)
  currency!: string;
}

@InputType()
export class ListServiceInput {
  @Field(() => String)
  listedById!: string;

  @Field(() => String)
  categoryId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  description!: string;

  @Field(() => ServicePriceInput)
  price!: ServicePriceInput;
}

@InputType()
export class UpdateServicePriceInput {
  @Field(() => String)
  serviceId!: string;

  @Field(() => ServicePriceInput)
  price!: ServicePriceInput;
}

@ObjectType()
export class ServiceGraphQLType implements ServiceResponseDto {
  @Field(() => ID)
  id!: string;

  @Field(() => String)
  listedById!: string;

  @Field(() => String)
  categoryId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  description!: string;

  @Field(() => ServicePriceType)
  price!: ServicePriceType;
}

@ObjectType()
export class ServiceOperationResultType
  implements
    ListServiceResponseDto,
    UpdateServicePriceResponseDto,
    DeactivateServiceResponseDto
{
  @Field(() => String)
  serviceId!: string;
}
