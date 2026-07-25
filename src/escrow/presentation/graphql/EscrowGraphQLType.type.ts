import { EscrowDTO } from '@escrow/application';
import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { EscrowStatus } from '@escrow/domain';

registerEnumType(EscrowStatus, { name: 'EscrowStatus' });

@ObjectType()
export class EscrowGraphQLType implements EscrowDTO {
  @Field()
  id: string;

  @Field(() => Number)
  amountNetWorker: number;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date, { nullable: true })
  releasedAt: Date;

  @Field(() => Date, { nullable: true })
  holdUntil: Date;

  @Field(() => String)
  errandId: string;

  @Field(() => String)
  workerId: string;

  @Field(() => String)
  clientId: string;

  @Field(() => Number)
  amountGross: number;

  @Field(() => Number)
  platformFee: number;

  @Field(() => EscrowStatus)
  status: EscrowStatus;

  @Field(() => Date, { nullable: true })
  completedAt: Date | null;

  @Field(() => Date, { nullable: true })
  refundedAt: Date | null;

  @Field(() => Date)
  updatedAt: Date;
}
