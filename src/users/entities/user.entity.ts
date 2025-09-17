import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';

export enum GqlUserRole {
  WORKER = 'WORKER',
  CLIENT = 'CLIENT',
}

export enum GqlOnboardingProgress {
  NONE = 'NONE',
  ROLE_SELECTED = 'ROLE_SELECTED',
  SERVICES_SELECTED = 'SERVICES_SELECTED',
  ADDRESS_ADDED = 'ADDRESS_ADDED',
  COMPLETED = 'COMPLETED',
}

registerEnumType(GqlUserRole, {
  name: 'UserRole', // exposed in GraphQL schema
});

registerEnumType(GqlOnboardingProgress, {
  name: 'OnboardingProgress',
});

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field()
  emailVerified: boolean;

  @Field({ nullable: true })
  image?: string | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field({ nullable: true })
  phoneNumber?: string | null;

  @Field({ nullable: true })
  phoneNumberVerified?: boolean | null;

  @Field({ nullable: true })
  username?: string | null;

  @Field({ nullable: true })
  displayUsername?: string | null;

  @Field({ nullable: true })
  country?: string | null;

  @Field({ nullable: true })
  twoFactorEnabled?: boolean | null;

  @Field(() => GqlUserRole, { nullable: true })
  activeRole?: GqlUserRole;

  @Field(() => GqlOnboardingProgress)
  onboardingProgress: GqlOnboardingProgress;

  @Field(() => ID, { nullable: true })
  activeAddressId?: string | null;
}
