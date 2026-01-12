import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProviderInput } from './dto/create-provider.input';
import { UpdateProviderInput } from './dto/update-provider.input';
import { ProviderDiscoveryResponse } from './dto/provider-discovery.response';
import { Provider } from './entities/provider.entity';
import { ErrandStatus } from '@prisma/client';

@Injectable()
export class ProviderService {
  constructor(private readonly prisma: PrismaService) {}

  create(createProviderInput: CreateProviderInput) {
    return 'This action adds a new provider';
  }

  findAll() {
    return `This action returns all provider`;
  }

  findOne(id: number) {
    return `This action returns a #${id} provider`;
  }

  async getProviders(userId: string): Promise<ProviderDiscoveryResponse> {
    const limit = 10;

    // 1. Get Client ID for the current user
    const client = await this.prisma.client.findUnique({
      where: { userId },
    });

    // 2. Trusted Providers (from Trusted Circles)
    let trustedProviders: Provider[] = [];
    if (client) {
      const trustedMembers = await this.prisma.trustedCircleMember.findMany({
        where: {
          trustedCircle: {
            clientId: client.id,
          },
        },
        include: {
          provider: {
            include: { user: true },
          },
        },
        take: limit,
      });
      trustedProviders = trustedMembers.map(
        (m) => m.provider as unknown as Provider,
      );
    }

    // 3. New Providers (recently joined users who are providers)
    const newProvidersRaw = await this.prisma.provider.findMany({
      orderBy: {
        user: {
          createdAt: 'desc',
        },
      },
      include: {
        user: true,
      },
      take: limit,
    });
    const newProviders = newProvidersRaw as unknown as Provider[];

    // 4. Popular Providers (most assigned errands)
    // Group errands by assignedTo to find popular provider IDs
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

    let popularProviders: Provider[] = [];
    if (popularProviderIds.length > 0) {
      const popularRaw = await this.prisma.provider.findMany({
        where: {
          id: { in: popularProviderIds },
        },
        include: {
          user: true,
        },
      });
      // Sort back to match popularity order
      popularProviders = popularProviderIds
        .map((id) => popularRaw.find((p) => p.id === id))
        .filter(
          (p): p is (typeof popularRaw)[0] => !!p,
        ) as unknown as Provider[];
    }

    // 5. Suggested Providers (based on recent services hired)
    let suggestedProviders: Provider[] = [];
    if (client) {
      // Get recent distinct services hired by this client
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
        // Find providers offering these services
        // We use ServicesOnProviders to link Provider -> Service
        const suggestedRaw = await this.prisma.provider.findMany({
          where: {
            services: {
              some: {
                serviceId: { in: serviceIds },
              },
            },
            // Exclude already found in popular/trusted/new to allow diversity?
            // Or keep as is. Let's keep distinct logic minimal for now.
            id: {
              notIn: [
                ...popularProviderIds,
                ...trustedProviders.map((p) => p.id),
              ],
            },
          },
          include: {
            user: true,
          },
          take: limit,
        });
        suggestedProviders = suggestedRaw as unknown as Provider[];
      }
    }

    // Fallback for Suggested if empty: Top rated? Or just random?
    // Stick to empty if no history.

    return {
      popular: popularProviders,
      new: newProviders,
      trusted: trustedProviders,
      suggested: suggestedProviders,
    };
  }

  update(id: number, updateProviderInput: UpdateProviderInput) {
    return `This action updates a #${id} provider`;
  }

  remove(id: number) {
    return `This action removes a #${id} provider`;
  }
}
