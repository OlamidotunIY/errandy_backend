import { ObjectType, Field } from "@nestjs/graphql";

@ObjectType()
export class ServiceGroup {
  @Field()
  name: string;

  @Field(() => [String])
  services: string[];
}
