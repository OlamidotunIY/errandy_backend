import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import
    {
        ClientDashboard,
        DashboardRequirement,
    } from './entities/client-dashboard.entity';

@Injectable()
export class ClientService
{
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Get the client dashboard data including requirements status,
     * active errands, and draft errands.
     */
    async getClientDashboard(userId: string): Promise<ClientDashboard>
    {
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

        if (!user)
        {
            throw new Error('User not found');
        }

        // Build requirements list
        const requirements = this.buildRequirements(user);

        // Get client's errands if they have a client profile
        let activeErrands: any[] = [];
        let draftErrands: any[] = [];
        let totalErrandsCount = 0;

        if (user.client)
        {
            const clientId = user.client.id;

            // Fetch active errands (OPEN or IN_PROGRESS)
            activeErrands = await this.prisma.errand.findMany({
                where: {
                    clientId,
                    status: {
                        in: ['OPEN', 'IN_PROGRESS'],
                    },
                },
                include: {
                    ratings: true,
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
            });

            // Fetch draft errands
            draftErrands = await this.prisma.errand.findMany({
                where: {
                    clientId,
                    status: 'DRAFT',
                },
                include: {
                    ratings: true,
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
            });

            // Get total errands count
            totalErrandsCount = await this.prisma.errand.count({
                where: { clientId },
            });
        }

        const completedRequirementsCount = requirements.filter(
            (r) => r.isCompleted,
        ).length;

        return {
            requirements,
            completedRequirementsCount,
            totalRequirementsCount: requirements.length,
            activeErrands,
            activeErrandsCount: activeErrands.length,
            draftErrands,
            draftErrandsCount: draftErrands.length,
            totalErrandsCount,
        };
    }

    /**
     * Build the requirements list based on user data
     */
    private buildRequirements(user: any): DashboardRequirement[]
    {
        const requirements: DashboardRequirement[] = [
            {
                key: 'phone',
                title: 'Verify your phone number',
                description: "Confirm it's you to be able to publish your first errand",
                requiredTo: 'publish errands',
                isCompleted: user.phoneNumberVerified === true,
                actionRoute: '/settings/verify-phone',
            },
            {
                key: 'email',
                title: 'Verify your email address',
                description: "Confirm it's you to be able to publish your first errand",
                requiredTo: 'publish errands',
                isCompleted: user.emailVerified === true,
                actionRoute: '/settings/verify-email',
            },
            {
                key: 'payment',
                title: 'Add a payment method',
                description: 'Add a payment method to be able to hire providers',
                requiredTo: 'hire providers',
                isCompleted:
                    user.client?.paymentMethods &&
                    user.client.paymentMethods.length > 0,
                actionRoute: '/settings/payment-methods',
            },
            {
                key: 'address',
                title: 'Add at least one Address',
                description:
                    'Add at least one Address to be able to publish your first errand',
                requiredTo: 'publish errands',
                isCompleted: user.userAddress && user.userAddress.length > 0,
                actionRoute: '/settings/addresses',
            },
        ];

        return requirements;
    }
}
