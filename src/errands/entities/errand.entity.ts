import { ObjectType, Field, Float, Int, ID } from '@nestjs/graphql';
import { ErrandStatus } from './errandStatus.enum';
import { ProviderType } from '../../provider/entities/provider-type.enum';
import { PricingType } from './pricingType.enum';
import Client from 'src/client/entities/client.entities';
import { Service } from 'src/service/entities/service.entity';
import { Rating } from 'src/rating/entities/rating.entity';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class Errand {
  @Field(() => ID)
  id: string;

  @Field()
  clientId: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => PricingType)
  pricingType: PricingType;

  @Field(() => Float, { nullable: true })
  price?: number;

  @Field(() => Float, { nullable: true })
  hourlyRate?: number;

  @Field(() => Float, { nullable: true })
  transportAllowance?: number;

  @Field(() => Float, { nullable: true })
  materialsBudget?: number;

  @Field(() => ErrandStatus, { nullable: true })
  status?: ErrandStatus;

  @Field(() => ProviderType, { nullable: true })
  providerType?: ProviderType;

  @Field({ nullable: true })
  providerOrgId?: string;

  @Field(() => String, { defaultValue: 'CLIENT_JOB' })
  sourceType: string;

  @Field({ nullable: true })
  serviceId?: string;

  @Field(() => Service, { nullable: true })
  service?: Service;

  @Field({ nullable: true })
  assignedTo?: string;

  @Field({ nullable: true })
  assignedAt?: Date;

  @Field(() => Int, { nullable: true })
  completionDurationDays?: number;

  @Field({ nullable: true })
  completionDeadline?: Date;

  @Field({ nullable: true })
  serviceAddress?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  location?: any;

  @Field({ nullable: true })
  templateId?: string;

  @Field()
  isRecurring: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => Client)
  client: Client;

  @Field(() => [Rating], { nullable: 'itemsAndList' })
  ratings?: Rating[];
}
