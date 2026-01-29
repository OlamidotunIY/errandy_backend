import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity';

export enum OrgRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

registerEnumType(OrgRole, {
  name: 'OrgRole',
});

@ObjectType()
export class OrgMember {
  @Field(() => ID)
  id: string;

  @Field()
  orgId: string;

  @Field()
  userId: string;

  @Field(() => OrgRole)
  role: OrgRole;

  @Field()
  active: boolean;

  @Field(() => User)
  user: User;
}
