import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateAddressInput, CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from '@prisma/client';
import { GqlUserRole, GqlOnboardingProgress } from './entities/user.entity';
import { globalEventEmitter } from 'src/utils/event-emitter.utils';
import { FirebaseStorageService } from 'src/firebase/firebase-storage.service';
import { FileUpload } from 'graphql-upload-ts';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseStorageService: FirebaseStorageService,
  ) {}

  findOne(id: string) {
    return this.prisma.user.findFirst({
      where: { id },
      include: {
        activeAddress: true,
        provider: {
          include: {
            services: true,
          },
        },
        userAddress: true,
      },
    });
  }

  async update(updateUserInput: UpdateUserInput) {
    const { id, role, imageFile, image, ...rest } = updateUserInput;
    let imageUrl = image;

    if (imageFile) {
      const upload = await imageFile;
      if (!upload.mimetype.startsWith('image/')) {
        throw new BadRequestException('Profile image must be an image file');
      }

      imageUrl = await this.uploadUserImage(id, upload);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...rest,
        ...(imageUrl !== undefined ? { image: imageUrl } : {}),
        ...(role && {
          roles: {
            push: role, // add role to array
          },
          activeRole: {
            set: role,
          },
        }),
      },
    });

    // Emit user.updated event when name, phone, or image is updated
    if (updateUserInput.name || updateUserInput.phoneNumber || imageUrl) {
      const nameParts = updateUserInput.name?.split(' ') || [];
      globalEventEmitter.emit('user.updated', {
        userId: id,
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' '),
        phone: updateUserInput.phoneNumber,
        imageUrl,
      });
    }

    return updatedUser;
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

    // Update onboarding progress if user is a provider
    if (user.activeRole === GqlUserRole.PROVIDER) {
      await this.updateOnboardingProgress(userId);
    }

    return updatedUser;
  }

  async deleteAddress(addressId: string, userId: string) {
    const user = await this.findOne(userId);
    if (!user) throw new BadRequestException('User not found');

    // Check if address belongs to user
    const address = await this.prisma.userAddress.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new BadRequestException(
        'Address not found or does not belong to user',
      );
    }

    // Check if this is the active address
    const isActiveAddress = user.activeAddressId === addressId;

    // Delete the address
    await this.prisma.userAddress.delete({
      where: { id: addressId },
    });

    // If deleted address was active, set another address as active (or null if none left)
    if (isActiveAddress) {
      const remainingAddresses = await this.prisma.userAddress.findMany({
        where: { userId },
        take: 1,
      });

      if (remainingAddresses.length > 0) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            activeAddress: { connect: { id: remainingAddresses[0].id } },
          },
        });
      } else {
        await this.prisma.user.update({
          where: { id: userId },
          data: { activeAddressId: null },
        });
      }
    }

    return { success: true, message: 'Address deleted successfully' };
  }

  private async uploadUserImage(userId: string, upload: FileUpload) {
    const safeName = this.sanitizeFilename(upload.filename);
    const destination = `users/${userId}/profile/${Date.now()}_${randomUUID()}_${safeName}`;

    const result = await this.firebaseStorageService.uploadStream({
      stream: upload.createReadStream(),
      destination,
      contentType: upload.mimetype,
      makePublic: true,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        originalName: upload.filename,
      },
    });

    return result.url;
  }

  private sanitizeFilename(filename: string) {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
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
              provider: {
                connectOrCreate: {
                  where: { userId: userId }, // assumes unique userId field in Provider
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
    if (!user || user.activeRole !== GqlUserRole.PROVIDER) return;

    const hasServices =
      user.provider?.services && user.provider.services.length > 0;
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
   * Add services to the provider. serviceIds are Prisma Service.id values.
   * This creates ServicesOnProviders records for the provider and updates onboarding progress.
   */
  async addServicesToWorker(serviceIds: string[], userId: string) {
    const user = await this.findOne(userId);
    if (!user) throw new BadRequestException('User not found');
    if (!user.provider) throw new BadRequestException('User is not a provider');

    const providerId = user.provider.id;

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
      this.prisma.servicesOnProviders.upsert({
        where: {
          providerId_serviceId: {
            providerId,
            serviceId,
          },
        },
        create: {
          providerId,
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
    if (!user || !user.provider) {
      throw new BadRequestException('User is not a provider or does not exist');
    }

    return this.prisma.search.findMany({
      where: {
        providerId: user.provider.id,
      },
      orderBy: {
        id: 'desc', // Most recent first
      },
      take: 20, // Limit to last 20 searches
    });
  }

  async saveSearchKeyword(userId: string, keyword: string) {
    const user = await this.findOne(userId);
    if (!user || !user.provider) {
      throw new BadRequestException('User is not a provider or does not exist');
    }

    // Check if this keyword already exists for this provider
    const existingSearch = await this.prisma.search.findFirst({
      where: {
        providerId: user.provider.id,
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
        providerId: user.provider.id,
      },
    });
  }

  async clearSearchHistory(userId: string) {
    const user = await this.findOne(userId);
    if (!user || !user.provider) {
      throw new BadRequestException('User is not a provider or does not exist');
    }

    await this.prisma.search.deleteMany({
      where: {
        providerId: user.provider.id,
      },
    });

    return { success: true, message: 'Search history cleared successfully' };
  }
}
