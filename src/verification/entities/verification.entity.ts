import { ObjectType, Field, ID } from '@nestjs/graphql';
import { VerificationType } from './verification-type.enum';
import { VerificationStatus } from './verification-status.enum';
import { Provider } from 'src/provider/entities/provider.entity';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
export class Verification {
  @Field(() => ID)
  id: string;

  @Field()
  identifier: string;

  @Field()
  value: string;

  @Field()
  providerId: string;

  @Field(() => VerificationType)
  type: VerificationType;

  @Field(() => VerificationStatus)
  status: VerificationStatus;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: any;

  @Field({ nullable: true })
  verifiedAt?: Date;

  @Field({ nullable: true })
  expiresAt?: Date;

  @Field()
  createdAt: Date;

  @Field(() => Provider, { nullable: true })
  provider?: Provider;
}
