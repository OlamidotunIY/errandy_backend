import { ObjectType, Field } from '@nestjs/graphql';
import { LedgerEntryGraphQLType } from './ledger-entry.type';

@ObjectType()
class LedgerHistoryPageType {
  @Field(() => [LedgerEntryGraphQLType])
  entries!: LedgerEntryGraphQLType[];

  @Field(() => String, { nullable: true })
  nextCursor!: string | null;
}

export { LedgerHistoryPageType };
