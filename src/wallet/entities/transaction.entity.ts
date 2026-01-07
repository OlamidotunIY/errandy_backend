import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { TxType } from './tx-type.enum';
import { TxStatus } from './tx-status.enum';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class Transaction {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field(() => Float)
  amount: number;

  @Field(() => TxType)
  type: TxType;

  @Field(() => TxStatus)
  status: TxStatus;

  @Field()
  reference: string;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: any;

  @Field()
  createdAt: Date;
}
