import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { BundleItem } from './bundle-item.entity';

@ObjectType()
export class ErrandBundle {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  description: string;

  @Field(() => Float)
  basePrice: number;

  @Field()
  active: boolean;

  @Field(() => [BundleItem], { nullable: 'itemsAndList' })
  items?: BundleItem[];
}
