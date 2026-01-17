import { InputType, Field, ID } from '@nestjs/graphql';
import { IsMongoId, IsString, MaxLength } from 'class-validator';

@InputType()
export class AddRatingReactionInput {
  @Field(() => ID)
  @IsMongoId()
  ratingId: string;

  @Field()
  @IsString()
  @MaxLength(10)
  emoji: string; // e.g. "👍", "❤️", "😊"
}

@InputType()
export class RemoveRatingReactionInput {
  @Field(() => ID)
  @IsMongoId()
  ratingId: string;
}

@InputType()
export class AddRatingReplyInput {
  @Field(() => ID)
  @IsMongoId()
  ratingId: string;

  @Field()
  @IsString()
  @MaxLength(500)
  content: string;
}

@InputType()
export class DeleteRatingReplyInput {
  @Field(() => ID)
  @IsMongoId()
  replyId: string;
}
