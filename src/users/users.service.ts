import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateAddressInput, CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from '@prisma/client';
import { GqlUserRole, GqlOnboardingProgress } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findOne(id: string) {
    return this.prisma.user.findFirst({
      where: { id },
      include: {
        activeAddress: true,
        worker: {
          include: {
            services: true,
          },
        },
        userAddress: true,
      },
    });
  }

  update(updateUserInput: UpdateUserInput) {
    return this.prisma.user.update({
      where: { id: updateUserInput.id },
      data: {
        ...updateUserInput,
        ...(updateUserInput.role && {
          roles: {
            push: updateUserInput.role, // add role to array
          },
          activeRole: {
            set: updateUserInput.role,
          },
        }),
      },
    });
  }

  async addAddress(dto: CreateAddressInput, userId: string) {
    const geoLocation: Prisma.InputJsonValue = {
      type: 'Point',
      coordinates: [Number(dto.longitude), Number(dto.latitude)],
    };

    const user = await this.findOne(userId);
    if (!user) throw new BadRequestException('User not found');

    const address = await this.prisma.userAddress.create({
      data: {
        label: dto.label,
        address: dto.address,
        location: geoLocation,
        user: {
          connect: { id: userId },
        },
      },
    });

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        activeAddress: {
          connect: {
            id: address.id,
          },
        },
      },
    });

    // Update onboarding progress if user is a worker
    if (user.activeRole === 'WORKER') {
      await this.updateOnboardingProgress(userId);
    }

    return updatedUser;
  }

  async switchRole(role: GqlUserRole, id: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        activeRole: role,
      },
    });
  }

  async createUserRole(userId: string, role: GqlUserRole) {
    const onboardingProgress =
      role === GqlUserRole.CLIENT
        ? GqlOnboardingProgress.COMPLETED
        : GqlOnboardingProgress.ROLE_SELECTED;

    return this.prisma.user.update({  
      where: { id: userId },
      data: {
        ...(role === GqlUserRole.CLIENT
          ? {
              client: {
                connectOrCreate: {
                  where: { userId: userId }, // assumes unique userId field in Client
                  create: {},
                },
              },
            }
          : {
              worker: {
                connectOrCreate: {
                  where: { userId: userId }, // assumes unique userId field in Worker
                  create: {},
                },
              },
            }),
        activeRole: role,
        onboardingProgress,
      },
    });
  }

  async updateOnboardingProgress(userId: string) {
    const user = await this.findOne(userId);
    if (!user || user.activeRole !== 'WORKER') return;

    const hasServices =
      user.worker?.services && user.worker.services.length > 0;
    const hasAddress = user.userAddress && user.userAddress.length > 0;

    let newProgress = user.onboardingProgress;

    if (hasServices && user.onboardingProgress === 'ROLE_SELECTED') {
      newProgress = 'SERVICES_SELECTED';
    }

    if (
      hasAddress &&
      ['ROLE_SELECTED', 'SERVICES_SELECTED'].includes(user.onboardingProgress)
    ) {
      newProgress = hasServices ? 'COMPLETED' : 'ADDRESS_ADDED';
    }

    if (hasServices && hasAddress && user.onboardingProgress !== 'COMPLETED') {
      newProgress = 'COMPLETED';
    }

    if (newProgress !== user.onboardingProgress) {
      return this.prisma.user.update({
        where: { id: userId },
        data: { onboardingProgress: newProgress },
      });
    }

    return user;
  }

  async updateOnboardingProgressManually(
    userId: string,
    progress: GqlOnboardingProgress,
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { onboardingProgress: progress },
    });
  }

  /**
   * Add services to the worker. serviceIds are Prisma Service.id values.
   * This creates ServicesOnWorkers records for the worker and updates onboarding progress.
   */
  async addServicesToWorker(serviceIds: string[], userId: string) {
    const user = await this.findOne(userId);
    if (!user) throw new BadRequestException('User not found');
    if (!user.worker) throw new BadRequestException('User is not a worker');

    const workerId = user.worker.id;

    // Deduplicate input
    const uniqueServiceIds = Array.from(new Set(serviceIds));

    // Validate all service IDs exist
    const services = await this.prisma.service.findMany({
      where: { id: { in: uniqueServiceIds } },
      select: { id: true },
    });

    const foundIds = new Set(services.map((s) => s.id));
    const missing = uniqueServiceIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      throw new BadRequestException(
        `Services not found: ${missing.join(', ')}`,
      );
    }

    // Create link records; use deterministic composite id to avoid duplicates
    const ops = uniqueServiceIds.map((serviceId) =>
      this.prisma.servicesOnWorkers.upsert({
        where: {
          workerId_serviceId: {
            workerId,
            serviceId,
          },
        },
        create: {
          workerId,
          serviceId,
        },
        update: {},
      }),
    );

    await Promise.all(ops);

    // Refresh onboarding progress
    await this.updateOnboardingProgress(userId);

    return this.findOne(userId);
  }

  async getUserSearchHistory(userId: string) {
    const user = await this.findOne(userId);
    if (!user || !user.worker) {
      throw new BadRequestException('User is not a worker or does not exist');
    }

    return this.prisma.search.findMany({
      where: {
        workerId: user.worker.id,
      },
      orderBy: {
        id: 'desc', // Most recent first
      },
      take: 20, // Limit to last 20 searches
    });
  }

  async saveSearchKeyword(userId: string, keyword: string) {
    const user = await this.findOne(userId);
    if (!user || !user.worker) {
      throw new BadRequestException('User is not a worker or does not exist');
    }

    // Check if this keyword already exists for this worker
    const existingSearch = await this.prisma.search.findFirst({
      where: {
        workerId: user.worker.id,
        keyword: keyword.toLowerCase().trim(),
      },
    });

    if (existingSearch) {
      // Update existing search to move it to top
      return this.prisma.search.update({
        where: { id: existingSearch.id },
        data: { keyword: keyword.toLowerCase().trim() },
      });
    }

    // Create new search record
    return this.prisma.search.create({
      data: {
        keyword: keyword.toLowerCase().trim(),
        workerId: user.worker.id,
      },
    });
  }

  async clearSearchHistory(userId: string) {
    const user = await this.findOne(userId);
    if (!user || !user.worker) {
      throw new BadRequestException('User is not a worker or does not exist');
    }

    await this.prisma.search.deleteMany({
      where: {
        workerId: user.worker.id,
      },
    });

    return { success: true, message: 'Search history cleared successfully' };
  }
}
