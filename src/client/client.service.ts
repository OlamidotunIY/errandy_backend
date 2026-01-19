import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  ClientDashboard,
  DashboardRequirement,
} from './entities/client-dashboard.entity';

@Injectable()
export class ClientService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the client dashboard data including requirements status,
   * active errands, and draft errands.
   */
  async getClientDashboard(userId: string): Promise<ClientDashboard> {
    // Get user with related data
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        client: {
          include: {
            paymentMethods: true,
          },
        },
        userAddress: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Build requirements list
    const requirements = this.buildRequirements(user);

    // Get client's errands if they have a client profile
    let activeErrands: any[] = [];
    let draftErrands: any[] = [];
    let totalErrandsCount = 0;
    let activeErrandsCount = 0;
    let draftErrandsCount = 0;
    let completedErrandsCount = 0;
    let totalSpent = 0;
    let walletBalance = 0;

    if (user.client) {
      const clientId = user.client.id;

      const [
        activeErrandsResult,
        draftErrandsResult,
        activeCount,
        draftCount,
        totalCount,
        completedErrands,
        wallet,
      ] = await Promise.all([
        // Fetch active errands (OPEN or IN_PROGRESS)
        this.prisma.errand.findMany({
          where: {
            clientId,
            status: {
              in: ['OPEN', 'IN_PROGRESS'],
            },
          },
          include: {
            ratings: true,
            service: true,
            client: {
              include: {
                user: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10, // Limit to recent 10
        }),
        // Fetch draft errands
        this.prisma.errand.findMany({
          where: {
            clientId,
            status: 'DRAFT',
          },
          include: {
            ratings: true,
            service: true,
            client: {
              include: {
                user: true,
              },
            },
          },
          orderBy: {
            updatedAt: 'desc',
          },
          take: 10, // Limit to recent 10
        }),
        // Counts
        this.prisma.errand.count({
          where: {
            clientId,
            status: {
              in: ['OPEN', 'IN_PROGRESS'],
            },
          },
        }),
        this.prisma.errand.count({
          where: {
            clientId,
            status: 'DRAFT',
          },
        }),
        this.prisma.errand.count({
          where: { clientId },
        }),
        // Completed errands for totals
        this.prisma.errand.findMany({
          where: {
            clientId,
            status: 'COMPLETED',
          },
          select: {
            price: true,
            hourlyRate: true,
            transportAllowance: true,
            materialsBudget: true,
          },
        }),
        // Wallet balance
        this.prisma.wallet.findUnique({
          where: {
            ownerId_ownerType: {
              ownerId: clientId,
              ownerType: 'CLIENT',
            },
          },
          select: {
            available: true,
          },
        }),
      ]);

      activeErrands = activeErrandsResult;
      draftErrands = draftErrandsResult;
      activeErrandsCount = activeCount;
      draftErrandsCount = draftCount;
      totalErrandsCount = totalCount;
      completedErrandsCount = completedErrands.length;
      totalSpent = completedErrands.reduce((sum, errand) => {
        return (
          sum +
          (errand.price ?? 0) +
          (errand.hourlyRate ?? 0) +
          (errand.transportAllowance ?? 0) +
          (errand.materialsBudget ?? 0)
        );
      }, 0);
      walletBalance = wallet?.available ?? 0;
    }

    const marketTrends = await this.getMarketTrends();

    const completedRequirementsCount = requirements.filter(
      (r) => r.isCompleted,
    ).length;

    return {
      requirements,
      completedRequirementsCount,
      totalRequirementsCount: requirements.length,
      activeErrands,
      activeErrandsCount,
      draftErrands,
      draftErrandsCount,
      totalErrandsCount,
      completedErrandsCount,
      totalSpent,
      walletBalance,
      marketTrends,
    };
  }

  /**
   * Build the requirements list based on user data
   */
  private buildRequirements(user: any): DashboardRequirement[] {
    const requirements: DashboardRequirement[] = [
      {
        key: 'phone',
        title: 'Verify your phone number',
        description: "Confirm it's you to be able to publish your first errand",
        requiredTo: 'publish errands',
        isCompleted: user.phoneNumberVerified === true,
      },
      {
        key: 'email',
        title: 'Verify your email address',
        description: "Confirm it's you to be able to publish your first errand",
        requiredTo: 'publish errands',
        isCompleted: user.emailVerified === true,
      },
      {
        key: 'payment',
        title: 'Add a payment method',
        description: 'Add a payment method to be able to hire providers',
        requiredTo: 'hire providers',
        isCompleted:
          user.client?.paymentMethods && user.client.paymentMethods.length > 0,
      },
      {
        key: 'address',
        title: 'Add at least one Address',
        description:
          'Add at least one Address to be able to publish your first errand',
        requiredTo: 'publish errands',
        isCompleted: user.userAddress && user.userAddress.length > 0,
      },
    ];

    return requirements;
  }

  private async getMarketTrends(): Promise<string[]> {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const trendErrands = await this.prisma.errand.findMany({
      where: {
        status: {
          not: 'DRAFT',
        },
        serviceId: {
          not: null,
        },
        createdAt: {
          gte: since,
        },
      },
      select: {
        service: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 250,
    });

    const counts = new Map<string, number>();
    for (const errand of trendErrands) {
      const name = errand.service?.name;
      if (!name) {
        continue;
      }
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
  }
}
