import { ObjectType, Field, Int, registerEnumType } from '@nestjs/graphql';
import { LedgerEntryDTO, LedgerEntryType } from '@wallet';

registerEnumType(LedgerEntryType, { name: 'LedgerEntryType' });

@ObjectType()
class LedgerEntryGraphQLType {
  @Field()
  id: string;

  @Field(() => LedgerEntryType)
  type: LedgerEntryType;

  @Field(() => Int)
  amountKobo: number;

  @Field()
  currency: string;

  @Field({ nullable: true })
  escrowId: string | null;

  @Field({ nullable: true })
  gatewayReference: string | null;

  @Field()
  createdAt: Date;
}

export { LedgerEntryGraphQLType };
