import { Injectable } from '@nestjs/common';
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
}
