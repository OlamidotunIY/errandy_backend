import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

export enum UserRole {
  RECRUITER = 'RECRUITER', // Client / job poster
  HUSTLR = 'HUSTLR', // Worker / service provider
}

registerEnumType(UserRole, { name: 'UserRole' });

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  username?: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  image?: string;

  @Field({ nullable: true })
  phoneNumber?: string;

  @Field({ nullable: true })
  displayUsername?: string;

  @Field(() => [UserRole], { nullable: true })
  roles: UserRole[];

  @Field(() => UserRole, { nullable: true })
  activeRole: UserRole;

  @Field(() => String, { nullable: true })
  activeAddressId: string;

  @Field(() => Boolean, { nullable: true })
  emailVerified: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
