import { ObjectType, Field, Int, registerEnumType } from '@nestjs/graphql';
import { LedgerEntryDTO, LedgerEntryType } from '@module/wallet';

registerEnumType(LedgerEntryType, { name: 'LedgerEntryType' });

@ObjectType()
class LedgerEntryGraphQLType implements LedgerEntryDTO {
  @Field()
  id!: string;

  @Field(() => LedgerEntryType)
  type!: LedgerEntryType;

  @Field(() => Int)
  amountMinorUnits!: number;

  @Field()
  currency!: string;

  @Field(() => String, { nullable: true })
  escrowId!: string | null;

  @Field(() => String, { nullable: true })
  gatewayReference!: string | null;

  @Field()
  createdAt!: Date;
}

export { LedgerEntryGraphQLType };
