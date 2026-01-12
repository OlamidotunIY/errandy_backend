import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class ShareCircleInput {
  @Field({ nullable: true })
  recipientEmail?: string;

  @Field({ nullable: true })
  recipientUserId?: string;
}
