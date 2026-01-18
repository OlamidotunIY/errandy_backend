import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateChatInput {
  @Field(() => [String])
  participantIds: string[];
}
