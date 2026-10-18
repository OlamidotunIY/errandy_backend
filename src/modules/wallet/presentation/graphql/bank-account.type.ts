import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class BankAccountType {
  @Field(() => ID)
  id!: string;

  @Field()
  ownerId!: string;

  @Field()
  currency!: string;

  @Field()
  bankCode!: string;

  @Field()
  accountNumber!: string;

  @Field(() => String, { nullable: true })
  accountName?: string | null;

  @Field(() => Boolean)
  isVerified!: boolean;

  @Field(() => Boolean)
  isDefault!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

@InputType()
export class AddBankAccountInput {
  @Field()
  bankCode!: string;

  @Field()
  accountNumber!: string;

  @Field({ nullable: true })
  accountName?: string;

  @Field({ defaultValue: 'NGN' })
  currency!: string;

  @Field({ defaultValue: false })
  isDefault!: boolean;
}

@InputType()
export class RequestWithdrawalInput {
  @Field(() => Int)
  amountMinorUnits!: number;

  @Field({ defaultValue: 'NGN' })
  currency!: string;

  @Field()
  bankAccountId!: string;
}

@ObjectType()
export class WithdrawalResultType {
  @Field(() => Boolean)
  success!: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field({ nullable: true })
  gatewayReference?: string;
}
