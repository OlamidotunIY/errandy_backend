import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
class WalletBalancesType {
  @Field(() => Int)
  activeKobo: number;

  @Field(() => Int)
  pendingKobo: number;

  @Field(() => Int)
  availableKobo: number;

  @Field()
  currency: string;
}

export { WalletBalancesType };
