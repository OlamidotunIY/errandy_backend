import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
class WalletBalancesType {
  @Field(() => Int)
  activeMinorUnits!: number;

  @Field(() => Int)
  pendingMinorUnits!: number;

  @Field(() => Int)
  availableMinorUnits!: number;

  @Field()
  currency!: string;
}

export { WalletBalancesType };
