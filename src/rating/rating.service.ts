import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RatingStats, RateeType } from './entities/rating.entity';

@Injectable()
export class RatingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get average rating and total reviews for a provider
   */
  async getProviderRating(providerId: string): Promise<RatingStats> {
    const result = await this.prisma.rating.aggregate({
      where: {
        rateeId: providerId,
        rateeType: RateeType.PROVIDER,
      },
      _avg: {
        rating: true,
      },
      _count: {
        rating: true,
      },
    });

    return {
      averageRating: result._avg.rating ?? 0,
      totalReviews: result._count.rating,
    };
  }

  /**
   * Get average rating and total reviews for a client
   */
  async getClientRating(clientId: string): Promise<RatingStats> {
    const result = await this.prisma.rating.aggregate({
      where: {
        rateeId: clientId,
        rateeType: RateeType.CLIENT,
      },
      _avg: {
        rating: true,
      },
      _count: {
        rating: true,
      },
    });

    return {
      averageRating: result._avg.rating ?? 0,
      totalReviews: result._count.rating,
    };
  }

  /**
   * Get ratings for multiple providers in a single query
   */
  async getProviderRatings(
    providerIds: string[],
  ): Promise<Map<string, RatingStats>> {
    const ratings = await this.prisma.rating.groupBy({
      by: ['rateeId'],
      where: {
        rateeId: { in: providerIds },
        rateeType: RateeType.PROVIDER,
      },
      _avg: {
        rating: true,
      },
      _count: {
        rating: true,
      },
    });

    const ratingsMap = new Map<string, RatingStats>();

    // Initialize all providers with default ratings
    providerIds.forEach((id) => {
      ratingsMap.set(id, { averageRating: 0, totalReviews: 0 });
    });

    // Update with actual ratings
    ratings.forEach((r) => {
      ratingsMap.set(r.rateeId, {
        averageRating: r._avg.rating ?? 0,
        totalReviews: r._count.rating,
      });
    });

    return ratingsMap;
  }

  /**
   * Get all ratings for a client (sent by providers)
   */
  async getClientRatings(clientId: string) {
    return this.prisma.rating.findMany({
      where: {
        rateeId: clientId,
        rateeType: RateeType.CLIENT,
      },
      include: {
        reactions: true,
        replies: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get ratings for a specific errand
   */
  async getErrandRatings(errandId: string) {
    return this.prisma.rating.findMany({
      where: {
        errandId,
      },
      include: {
        reactions: true,
        replies: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Add a reaction to a rating (toggle - removes if exists)
   */
  async toggleReaction(ratingId: string, userId: string, emoji: string) {
    const existing = await this.prisma.ratingReaction.findUnique({
      where: {
        ratingId_userId: { ratingId, userId },
      },
    });

    if (existing) {
      // If same emoji, remove it; otherwise update
      if (existing.emoji === emoji) {
        await this.prisma.ratingReaction.delete({
          where: { id: existing.id },
        });
        return null;
      } else {
        return this.prisma.ratingReaction.update({
          where: { id: existing.id },
          data: { emoji },
        });
      }
    }

    return this.prisma.ratingReaction.create({
      data: { ratingId, userId, emoji },
    });
  }

  /**
   * Add a reply to a rating
   */
  async addReply(ratingId: string, userId: string, content: string) {
    // Verify rating exists
    const rating = await this.prisma.rating.findUnique({
      where: { id: ratingId },
    });
    if (!rating) {
      throw new NotFoundException('Rating not found');
    }

    return this.prisma.ratingReply.create({
      data: { ratingId, userId, content },
    });
  }

  /**
   * Delete a reply (only the author can delete)
   */
  async deleteReply(replyId: string, userId: string) {
    const reply = await this.prisma.ratingReply.findUnique({
      where: { id: replyId },
    });
    if (!reply) {
      throw new NotFoundException('Reply not found');
    }
    if (reply.userId !== userId) {
      throw new ForbiddenException('You can only delete your own replies');
    }

    return this.prisma.ratingReply.delete({
      where: { id: replyId },
    });
  }
}
