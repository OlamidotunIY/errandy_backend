import { Injectable } from '@nestjs/common';
import { RatingService } from '../rating/rating.service';
import { ProviderDiscoveryResponse } from './dto/provider-discovery.response';
import { SearchProvidersInput } from './dto/search-providers.input';
import { PrismaService } from 'src/prisma.service';
import { Provider } from './entities/provider.entity';
import { ErrandStatus } from 'src/errands/entities/errandStatus.enum';
import { Prisma } from '@prisma/client';

type ProviderWithInclude = Prisma.ProviderGetPayload<{
  include: {
    user: {
      include: {
        activeAddress: true;
      };
    };
    services: {
      include: {
        service: true;
      };
    };
  };
}>;

@Injectable()
export class ProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ratingService: RatingService,
  ) {}

  /**
   * Enrich provider objects with their services, active address, and ratings
   */
  private async enrichProviders(
    providers: ProviderWithInclude[],
  ): Promise<Provider[]> {
    if (providers.length === 0) return [];

    const providerIds = providers.map((p) => p.id);
    const ratingsMap = await this.ratingService.getProviderRatings(providerIds);

    return providers.map((p) => {
      // Map services from join table
      const services = p.services?.map((s) => s.service) || [];

      // Extract active address from user
      const activeAddress = p.user?.activeAddress;

      return {
        ...p,
        services,
        activeAddress,
        rating: ratingsMap.get(p.id) || { averageRating: 0, totalReviews: 0 },
      } as unknown as Provider;
    });
  }

  private get providerInclude() {
    return {
      user: {
        include: {
          activeAddress: true,
        },
      },
      services: {
        include: {
          service: true,
        },
      },
    };
  }

  async getProviders(userId: string): Promise<ProviderDiscoveryResponse> {
    const limit = 10;

    // 1. Get Client ID for the current user
    const client = await this.prisma.client.findUnique({
      where: { userId },
    });

    // 2. Trusted Providers
    let trustedProvidersRaw: ProviderWithInclude[] = [];
    if (client) {
      const trustedMembers = await this.prisma.trustedCircleMember.findMany({
        where: {
          trustedCircle: {
            clientId: client.id,
          },
        },
        include: {
          provider: {
            include: this.providerInclude,
          },
        },
        take: limit,
      });
      trustedProvidersRaw = trustedMembers.map((m) => m.provider);
    }

    // 3. New Providers
    const newProvidersRaw = await this.prisma.provider.findMany({
      orderBy: {
        user: {
          createdAt: 'desc',
        },
      },
      include: this.providerInclude,
      take: limit,
    });

    // 4. Popular Providers
    const popularGroups = await this.prisma.errand.groupBy({
      by: ['assignedTo'],
      _count: {
        assignedTo: true,
      },
      where: {
        status: ErrandStatus.COMPLETED,
        assignedTo: { not: null },
      },
      orderBy: {
        _count: {
          assignedTo: 'desc',
        },
      },
      take: limit,
    });

    const popularProviderIds = popularGroups
      .map((g) => g.assignedTo)
      .filter((id): id is string => !!id);

    let popularProvidersRaw: ProviderWithInclude[] = [];
    if (popularProviderIds.length > 0) {
      const popularRaw = await this.prisma.provider.findMany({
        where: {
          id: { in: popularProviderIds },
        },
        include: this.providerInclude,
      });
      // Sort back to match popularity order
      popularProvidersRaw = popularProviderIds
        .map((id) => popularRaw.find((p) => p.id === id))
        .filter((p) => !!p);
    }

    // 5. Suggested Providers
    let suggestedProvidersRaw: ProviderWithInclude[] = [];
    if (client) {
      const recentErrands = await this.prisma.errand.findMany({
        where: {
          clientId: client.id,
          serviceId: { not: null },
        },
        orderBy: {
          createdAt: 'desc',
        },
        distinct: ['serviceId'],
        take: 5,
        select: { serviceId: true },
      });

      const serviceIds = recentErrands
        .map((e) => e.serviceId)
        .filter((id): id is string => !!id);

      if (serviceIds.length > 0) {
        suggestedProvidersRaw = await this.prisma.provider.findMany({
          where: {
            services: {
              some: {
                serviceId: { in: serviceIds },
              },
            },
            id: {
              notIn: [
                ...popularProviderIds,
                ...trustedProvidersRaw.map((p) => p.id),
              ],
            },
          },
          include: this.providerInclude,
          take: limit,
        });
      }
    }

    // Enrich all groups
    const [popular, itemsNew, trusted, suggested] = await Promise.all([
      this.enrichProviders(popularProvidersRaw),
      this.enrichProviders(newProvidersRaw),
      this.enrichProviders(trustedProvidersRaw),
      this.enrichProviders(suggestedProvidersRaw),
    ]);

    return {
      popular,
      new: itemsNew,
      trusted,
      suggested,
    };
  }

  async searchProviders(input: SearchProvidersInput): Promise<Provider[]> {
    const { query, serviceIds, providerTypes, tiers, pagination } = input;
    const { page = 1, limit = 20 } = pagination || {};
    const skip = (page - 1) * limit;

    const whereClause: Prisma.ProviderWhereInput = {};

    // Text search on name
    if (query) {
      whereClause.user = {
        name: { contains: query, mode: 'insensitive' },
      };
    }

    // Service filter
    if (serviceIds && serviceIds.length > 0) {
      whereClause.services = {
        some: {
          serviceId: { in: serviceIds },
        },
      };
    }

    // Provider Type filter
    if (providerTypes && providerTypes.length > 0) {
      whereClause.providerType = { in: providerTypes };
    }

    // Tier filter
    if (tiers && tiers.length > 0) {
      whereClause.tier = { in: tiers };
    }

    const providersRaw = await this.prisma.provider.findMany({
      where: whereClause,
      include: this.providerInclude,
      skip,
      take: limit,
    });

    let providers = await this.enrichProviders(providersRaw);

    // Rating filter
    if (input.minRating && input.minRating > 0) {
      providers = providers.filter(
        (p) => (p.rating?.averageRating ?? 0) >= input.minRating!,
      );
    }

    return providers;
  }
}
