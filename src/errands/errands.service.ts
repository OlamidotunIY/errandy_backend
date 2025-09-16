import { Injectable } from '@nestjs/common';
import { CreateErrandInput } from './dto/create-errand.input';
import {
  UpdateErrandInput,
  UpdateErrandLocation,
} from './dto/update-errand.input';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from '@prisma/client';
import { GetAllErrandInput } from './dto/get-all-errand.input';
import { GqlServiceCategoryType } from 'src/service/entities/enums';

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

@Injectable()
export class ErrandsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createErrandInput: CreateErrandInput, userId: string) {
    return this.prisma.errand.create({
      data: {
        ...createErrandInput,
        userId,
      },
    });
  }

  async findAll(dto: GetAllErrandInput, userId: string) {
    const meters = (dto.maxDistanceKm ?? 5) * 1000; // default to 5km

    // Get user's active address + workerType + skills
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      include: {
        activeAddress: true,
        worker: {
          include: {
            services: true,
          },
        },
      },
    });

    if (!user?.activeAddress?.location) {
      throw new Error('No active address set for user');
    }

    const location = user.activeAddress.location as unknown as GeoPoint;
    const userLat = location.coordinates[1];
    const userLng = location.coordinates[0];

    // Create conditions for matching jobs
    let priorityMatch: Record<string, any> = {};
    if (user?.worker?.services?.length) {
      priorityMatch.service = { $in: user.worker.services };
    }

    return this.prisma.errand.aggregateRaw({
      pipeline: [
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [userLng, userLat] },
            distanceField: 'distance',
            maxDistance: meters,
            spherical: true,
          },
        },
        {
          $match: {
            status: 'OPEN',
            workerType: user.worker?.workerType,
          },
        },
        {
          $addFields: {
            priority: {
              $cond: [
                {
                  $or: priorityMatch.service
                    ? [{ $in: ['$service', user.worker?.services] }]
                    : [],
                },
                1,
                0,
              ],
            },
          } as Prisma.InputJsonValue,
        },
        {
          $sort: {
            priority: -1, // Matches first
            distance: 1, // Then closest
          },
        },
      ],
    });
  }

  findOne(id: string) {
    return this.prisma.errand.findUnique({
      where: {
        id,
      },
    });
  }

  update(updateErrandInput: UpdateErrandInput) {
    return this.prisma.errand.update({
      where: {
        id: updateErrandInput.id,
      },
      data: updateErrandInput,
    });
  }

  updateLocation(UpdateErrandLocation: UpdateErrandLocation) {
    const geoLocation: Prisma.InputJsonValue = {
      type: 'Point',
      coordinates: [
        Number(UpdateErrandLocation.longitude),
        Number(UpdateErrandLocation.latitude),
      ],
    };

    return this.prisma.errand.update({
      where: {
        id: UpdateErrandLocation.id,
      },
      data: {
        serviceAddress: UpdateErrandLocation.serviceAddress,
        location: geoLocation,
      },
    });
  }

  remove(id: string) {
    return this.prisma.errand.delete({
      where: {
        id,
      },
    });
  }
}
