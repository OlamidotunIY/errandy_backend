import {
  Rating,
  RatingReactionProps,
  RatingReplyProps,
} from '../entities';

export abstract class IRatingRepository {
  abstract findById(id: string): Promise<Rating | null>;
  abstract findByErrandId(errandId: string): Promise<Rating[]>;
  abstract findByRateeId(rateeId: string, limit?: number): Promise<Rating[]>;
  abstract save(rating: Rating): Promise<void>;
  abstract addReaction(
    ratingId: string,
    userId: string,
    emoji: string,
  ): Promise<RatingReactionProps>;
  abstract addReply(
    ratingId: string,
    userId: string,
    content: string,
  ): Promise<RatingReplyProps>;
  abstract getReactions(ratingId: string): Promise<RatingReactionProps[]>;
  abstract getReplies(ratingId: string): Promise<RatingReplyProps[]>;
}
