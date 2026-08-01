import { ObjectType, Field } from '@nestjs/graphql';
import { LedgerEntryGraphQLType } from './';

@ObjectType()
class LedgerHistoryPageType {
  @Field(() => [LedgerEntryGraphQLType])
  entries!: LedgerEntryGraphQLType[];

  @Field(() => String, { nullable: true })
  nextCursor!: string | null;
}

export { LedgerHistoryPageType };
