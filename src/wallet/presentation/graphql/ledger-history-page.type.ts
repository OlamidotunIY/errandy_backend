import { ObjectType, Field } from '@nestjs/graphql';
import { LedgerEntryGraphQLType } from './ledger-entry.type';

@ObjectType()
class LedgerHistoryPageType {
  @Field(() => [LedgerEntryGraphQLType])
  entries: LedgerEntryGraphQLType[];

  @Field({ nullable: true })
  nextCursor: string | null;
}

export { LedgerHistoryPageType };
