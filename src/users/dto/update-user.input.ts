import { InputType, Field, PartialType } from '@nestjs/graphql';
import { CreateUserInput } from './create-user.input';
import { GqlUserRole } from '../entities/user.entity';

@InputType()
export class UpdateUserInput extends PartialType(CreateUserInput) {
  @Field(() => String)
  id: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  username?: string;

  @Field({ nullable: true })
  image?: string;

  @Field({ nullable: true })
  phoneNumber?: string;

  @Field({ nullable: true })
  displayUsername?: string;

  @Field(() => GqlUserRole, { nullable: true })
  role?: GqlUserRole;
}
