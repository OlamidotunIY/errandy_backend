import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Errand } from 'src/errands/entities/errand.entity';

@ObjectType()
export class DashboardRequirement {
  @Field()
  key: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field()
  requiredTo: string;

  @Field()
  isCompleted: boolean;
}

@ObjectType()
export class ClientDashboard {
  @Field(() => [DashboardRequirement])
  requirements: DashboardRequirement[];

  @Field(() => Int)
  completedRequirementsCount: number;

  @Field(() => Int)
  totalRequirementsCount: number;

  @Field(() => [Errand])
  activeErrands: Errand[];

  @Field(() => Int)
  activeErrandsCount: number;

  @Field(() => [Errand])
  draftErrands: Errand[];

  @Field(() => Int)
  draftErrandsCount: number;

  @Field(() => Int)
  totalErrandsCount: number;
}
