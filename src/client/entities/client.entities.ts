import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Errand } from 'src/errands/entities/errand.entity';
import { User } from 'src/users/entities/user.entity';
import { PaymentMethod } from 'src/payment-gateway/entities/payment-method.entity';
import { Rating } from 'src/rating/entities/rating.entity';
import { RecurringContract } from 'src/errands/entities/recurring-contract.entity';

@ObjectType()
export class Client {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field(() => User)
  user: User;

  @Field(() => [Errand], { nullable: 'itemsAndList' })
  errands?: Errand[];

  @Field(() => [PaymentMethod], { nullable: 'itemsAndList' })
  paymentMethods?: PaymentMethod[];

  @Field(() => [Rating], { nullable: 'itemsAndList' })
  ratings?: Rating[];

  @Field(() => [RecurringContract], { nullable: 'itemsAndList' })
  recurringContracts?: RecurringContract[];
}

export default Client;
