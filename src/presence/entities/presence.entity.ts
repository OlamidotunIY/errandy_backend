import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsDate, IsEnum, IsString } from 'class-validator';

export enum PresenceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

registerEnumType(PresenceStatus, { name: 'PresenceStatus' });

@ObjectType()
export class UserPresence {
  @Field(() => ID)
  @IsString()
  userId: string;

  @Field(() => PresenceStatus)
  @IsEnum(PresenceStatus)
  status: PresenceStatus;

  @Field(() => Date, { nullable: true })
  @IsDate()
  lastSeenAt?: Date;
}
