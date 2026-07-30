import { ObjectType, Field, Int, registerEnumType } from '@nestjs/graphql';
import { LedgerEntryDTO, LedgerEntryType } from 'src/modules/wallet';

registerEnumType(LedgerEntryType, { name: 'LedgerEntryType' });

@ObjectType()
class LedgerEntryGraphQLType implements LedgerEntryDTO {
  @Field()
  id: string;

  @Field(() => LedgerEntryType)
  type: LedgerEntryType;

  @Field(() => Int)
  amountKobo: number;

  @Field()
  currency: string;

  @Field(() => String, { nullable: true })
  escrowId: string | null;

  @Field(() => String, { nullable: true })
  gatewayReference: string | null;

  @Field()
  createdAt: Date;
}

export { LedgerEntryGraphQLType };
