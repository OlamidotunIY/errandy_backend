import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Errand } from 'src/errands/entities/errand.entity';
import { User } from 'src/users/entities/user.entity';

@ObjectType()
export class Client {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field(() => User)
  user: User;

  @Field(() => [Errand])
  errands: Errand[];

  // paymentMethods and Errands relations can be added as needed
}

export default Client;
