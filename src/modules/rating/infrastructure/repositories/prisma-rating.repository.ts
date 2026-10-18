import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import {
  IRatingRepository,
  Rating,
  RatingProps,
  RatingReactionProps,
  RatingReplyProps,
} from '../../domain';
import { randomUUID } from 'crypto';

@Injectable()
export class PrismaRatingRepository implements IRatingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Rating | null> {
    const record = await this.prisma.rating.findUnique({
      where: { id },
    });
    if (!record) return null;
    return new Rating(record as unknown as RatingProps);
  }

  async findByErrandId(errandId: string): Promise<Rating[]> {
    const records = await this.prisma.rating.findMany({
      where: { errandId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => new Rating(r as unknown as RatingProps));
  }

  async findByRateeId(rateeId: string, limit = 20): Promise<Rating[]> {
    const records = await this.prisma.rating.findMany({
      where: { rateeId, context: 'CLIENT_FACING' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return records.map((r) => new Rating(r as unknown as RatingProps));
  }

  async save(rating: Rating): Promise<void> {
    const data = rating.toPrimitives();
    await this.prisma.rating.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        errandId: data.errandId,
        raterId: data.raterId,
        rateeId: data.rateeId,
        context: data.context,
        score: data.score,
        comment: data.comment ?? null,
        createdAt: data.createdAt,
      },
      update: {
        score: data.score,
        comment: data.comment ?? null,
      },
    });
  }

  async addReaction(
    ratingId: string,
    userId: string,
    emoji: string,
  ): Promise<RatingReactionProps> {
    return this.prisma.ratingReaction.upsert({
      where: {
        ratingId_userId: { ratingId, userId },
      },
      create: {
        id: randomUUID(),
        ratingId,
        userId,
        emoji,
      },
      update: {
        emoji,
      },
    });
  }

  async addReply(
    ratingId: string,
    userId: string,
    content: string,
  ): Promise<RatingReplyProps> {
    return this.prisma.ratingReply.create({
      data: {
        id: randomUUID(),
        ratingId,
        userId,
        content,
      },
    });
  }

  async getReactions(ratingId: string): Promise<RatingReactionProps[]> {
    return this.prisma.ratingReaction.findMany({
      where: { ratingId },
    });
  }

  async getReplies(ratingId: string): Promise<RatingReplyProps[]> {
    return this.prisma.ratingReply.findMany({
      where: { ratingId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
