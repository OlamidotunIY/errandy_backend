import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ProviderTier } from '@module/party';
import { CategoryTreeNodeResponseDto } from '../../application';

@ObjectType()
export class CategoryTreeNodeType implements CategoryTreeNodeResponseDto {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => ProviderTier, { nullable: true })
  requiredTier!: ProviderTier | null;

  @Field(() => [CategoryTreeNodeType])
  children!: CategoryTreeNodeType[];
}
