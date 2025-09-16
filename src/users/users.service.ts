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

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        activeAddress: {
          create: {
            label: dto.label,
            address: dto.address,
            location: geoLocation,
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
    const onboardingProgress = role === GqlUserRole.CLIENT
      ? GqlOnboardingProgress.COMPLETED
      : GqlOnboardingProgress.ROLE_SELECTED;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(role === GqlUserRole.CLIENT
          ? { client: { create: {} } }
          : { worker: { create: {} } }),
        activeRole: role,
        onboardingProgress,
      },
    });
  }

  async updateOnboardingProgress(userId: string) {
    const user = await this.findOne(userId);
    if (!user || user.activeRole !== 'WORKER') return;

    const hasServices = user.worker?.services && user.worker.services.length > 0;
    const hasAddress = user.userAddress && user.userAddress.length > 0;

    let newProgress = user.onboardingProgress;

    if (hasServices && user.onboardingProgress === 'ROLE_SELECTED') {
      newProgress = 'SERVICES_SELECTED';
    }

    if (hasAddress && ['ROLE_SELECTED', 'SERVICES_SELECTED'].includes(user.onboardingProgress)) {
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

  async updateOnboardingProgressManually(userId: string, progress: GqlOnboardingProgress) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { onboardingProgress: progress },
    });
  }
}
