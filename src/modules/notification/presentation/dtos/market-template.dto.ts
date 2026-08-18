import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class MarketTemplateDto {
  @Field()
  id: string;

  @Field()
  marketId: string;

  @Field()
  type: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  subject?: string;

  @Field({ nullable: true })
  html?: string;

  @Field({ nullable: true })
  text?: string;
}
