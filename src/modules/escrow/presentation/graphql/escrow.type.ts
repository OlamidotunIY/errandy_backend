import { EscrowDTO } from '@module/escrow';
import { EscrowStatus } from '@module/escrow/domain';
import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

registerEnumType(EscrowStatus, { name: 'EscrowStatus' });

@ObjectType()
export class EscrowGraphQLType implements EscrowDTO {
  @Field()
  id!: string;

  @Field(() => Number)
  amountNetWorker!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date, { nullable: true })
  releasedAt!: Date;

  @Field(() => Date, { nullable: true })
  holdUntil!: Date;

  @Field(() => String)
  errandId!: string;

  @Field(() => String)
  providerPartyId!: string;

  @Field(() => String)
  clientPartyId!: string;

  @Field(() => Number)
  amountGross!: number;

  @Field(() => Number)
  platformFee!: number;

  @Field(() => EscrowStatus)
  status!: EscrowStatus;

  @Field(() => Date, { nullable: true })
  completedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  refundedAt!: Date | null;

  @Field(() => Date)
  updatedAt!: Date;
}
