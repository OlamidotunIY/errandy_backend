import { ObjectType, Field, ID } from '@nestjs/graphql';
import { ErrandTemplate } from './errand-template.entity';

@ObjectType()
export class BundleItem {
  @Field(() => ID)
  id: string;

  @Field()
  bundleId: string;

  @Field()
  templateId: string;

  @Field(() => ErrandTemplate, { nullable: true })
  template?: ErrandTemplate;
}
