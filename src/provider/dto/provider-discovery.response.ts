import { ObjectType, Field } from '@nestjs/graphql';
import { Provider } from '../entities/provider.entity';

@ObjectType()
export class ProviderDiscoveryResponse {
  @Field(() => [Provider])
  popular: Provider[];

  @Field(() => [Provider])
  new: Provider[];

  @Field(() => [Provider])
  trusted: Provider[];

  @Field(() => [Provider])
  suggested: Provider[];
}
