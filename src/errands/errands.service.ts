import { Injectable, Inject } from '@nestjs/common';
import { CreateErrandInput } from './dto/create-errand.input';
import {
  UpdateErrandInput,
  UpdateErrandLocation,
} from './dto/update-errand.input';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from '@prisma/client';
import { GetAllErrandInput } from './dto/get-all-errand.input';
import { ErrandQueryInput } from './dto/errand-query.input';
import { ErrandType } from './dto/errand-type.enum';
import { PaginatedErrands } from './entities/paginated-errands.entity';
import { UsersService } from 'src/users/users.service';
import { PubSubInterface } from 'src/pubsub';

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

@Injectable()
export class ErrandsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('PUB_SUB') private readonly pubSub: PubSubInterface,
    private readonly usersService: UsersService,
  ) {}

  async create(createErrandInput: CreateErrandInput, userId: string) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) {
      throw new Error('Client not found');
    }

    console.log(createErrandInput);

    const errand = await this.prisma.errand.create({
      data: {
        ...createErrandInput,
        clientId: client?.id,
      },
      include: {
        client: true,
      },
    });

    // Publish errand created event for real-time updates
    await this.pubSub.publish('errandCreated', {
      errandCreated: {
        errand,
        type: 'CREATED',
        userId,
      },
    });

    return errand;
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

    try {
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
    } catch (error) {
      // Fallback to regular query if geospatial index is not available
      if (
        error.code === 'P2010' &&
        error.message?.includes('$geoNear requires')
      ) {
        console.warn(
          'Geospatial index not found in findAll, falling back to regular query',
        );
        return this.prisma.errand.findMany({
          where: {
            status: 'OPEN',
            ...(user.worker?.workerType && {
              workerType: user.worker.workerType,
            }),
          },
          include: {
            ratings: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
      }
      throw error;
    }
  }

  async findOne(id: string) {
    const errand = await this.prisma.errand.findUnique({
      where: {
        id,
      },
      include: {
        service: true,
        client: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!errand) {
      throw new Error('Errand not found');
    }

    return errand;
  }

  async update(updateErrandInput: UpdateErrandInput) {
    const { id, serviceId, ...updateData } = updateErrandInput;

    const errand = await this.prisma.errand.update({
      where: {
        id,
      },
      data: {
        ...updateData,
        ...(serviceId && {
          service: {
            connect: {
              id: serviceId,
            },
          },
        }),
      },
      include: {
        client: true,
      },
    });

    // Publish errand updated event for real-time updates
    await this.pubSub.publish('errandUpdated', {
      errandUpdated: {
        errand,
        type: 'UPDATED',
        userId: errand.clientId,
      },
    });

    return errand;
  }

  async saveErrand(id: string, userId: string) {
    const errand = await this.findOne(id);
    if (!errand) {
      throw new Error('Errand not found');
    }

    const savedErrand = await this.prisma.savedErrand.create({
      data: {
        userId,
        errandId: id,
        savedAt: new Date(),
      },
    });

    return savedErrand;
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

  async remove(id: string) {
    const errand = await this.prisma.errand.findUnique({
      where: { id },
      include: { ratings: true },
    });

    if (!errand) {
      throw new Error('Errand not found');
    }

    await this.prisma.errand.delete({
      where: { id },
    });

    // Publish errand deleted event for real-time updates
    await this.pubSub.publish('errandDeleted', {
      errandDeleted: {
        errand,
        type: 'DELETED',
        userId: errand.clientId,
      },
    });

    return errand;
  }

  /**
   * Advanced get errands with personalized feeds and location-based filtering
   */
  async getErrands(
    queryInput: ErrandQueryInput,
    userId: string,
  ): Promise<PaginatedErrands> {
    console.log(
      'ErrandsService.getErrands called with:',
      JSON.stringify(queryInput, null, 2),
    );
    const {
      type = ErrandType.FEED,
      search,
      pagination,
      maxDistanceKm = 20,
    } = queryInput;
    const { page = 1, limit = 10 } = pagination || {};

    const skip = (page - 1) * limit;

    switch (type) {
      case ErrandType.FEED:
        return this.getFeedErrands(userId, skip, limit, maxDistanceKm);
      case ErrandType.BEST_MATCH:
        return this.getBestMatchErrands(userId, skip, limit, maxDistanceKm);
      case ErrandType.MOST_RECENT:
        return this.getRecentErrands(userId, skip, limit, maxDistanceKm);
      case ErrandType.SAVED:
        return this.getSavedErrands(userId, skip, limit);
      case ErrandType.SEARCH:
        return this.searchErrands(
          userId,
          search || '',
          skip,
          limit,
          maxDistanceKm,
        );
      default:
        return this.getFeedErrands(userId, skip, limit, maxDistanceKm);
    }
  }

  /**
   * Get user's active address for location-based filtering
   */
  private async getUserActiveAddress(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      include: {
        activeAddress: true,
        worker: {
          include: {
            services: true,
          },
        },
        client: true, // Include client to get the client.id for filtering
      },
    });

    if (!user?.activeAddress?.location) {
      throw new Error('No active address set for user');
    }

    return {
      user,
      location: user.activeAddress.location as unknown as GeoPoint,
      clientId: user.client?.id, // Add clientId for filtering
    };
  }

  /**
   * Feed: Personalized errands based on location and user preferences
   */
  async getFeedErrands(
    userId: string,
    skip: number,
    limit: number,
    maxDistanceKm: number,
  ): Promise<PaginatedErrands> {
    const { user, location, clientId } =
      await this.getUserActiveAddress(userId);
    const meters = maxDistanceKm * 1000;
    const userLat = location.coordinates[1];
    const userLng = location.coordinates[0];

    // Build priority matching criteria
    let priorityMatch: Record<string, any> = {};
    if (user?.worker?.services?.length) {
      priorityMatch.service = { $in: user.worker.services };
    }

    const pipeline = [
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
          ...(clientId && { clientId: { $ne: clientId } }), // Exclude user's own errands if they have a client profile
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
          } as Prisma.InputJsonValue,
        },
      },
      {
        $sort: {
          priority: -1, // Matches first
          distance: 1, // Then closest
          createdAt: -1, // Then newest
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    // MongoDB aggregation returns Prisma.JsonObject, which we handle properly
    const result = await this.prisma.errand.aggregateRaw({ pipeline });
    const errands = this.parseAggregationResults(result);
    const total = await this.getErrandsCount(userId, maxDistanceKm);
    const page = Math.floor(skip / limit) + 1;

    return this.buildPaginatedResponse(errands, total, page, limit, userId);
  }

  /**
   * Best Match: Errands matching user's skills and preferences
   */
  async getBestMatchErrands(
    userId: string,
    skip: number,
    limit: number,
    maxDistanceKm: number,
  ): Promise<PaginatedErrands> {
    const { user, location, clientId } =
      await this.getUserActiveAddress(userId);
    const meters = maxDistanceKm * 1000;
    const userLat = location.coordinates[1];
    const userLng = location.coordinates[0];

    const pipeline = [
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
          ...(clientId && { clientId: { $ne: clientId } }),
          $or: [
            { service: { $in: user.worker?.services || [] } },
            { profession: user.worker?.workerType },
          ],
        },
      },
      {
        $addFields: {
          matchScore: {
            $add: [
              {
                $cond: [
                  { $in: ['$service', user.worker?.services || []] },
                  2,
                  0,
                ],
              },
              {
                $cond: [
                  { $eq: ['$profession', user.worker?.workerType] },
                  1,
                  0,
                ],
              },
            ],
          } as Prisma.InputJsonValue,
        },
      },
      {
        $sort: {
          matchScore: -1,
          distance: 1,
          createdAt: -1,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    const result = await this.prisma.errand.aggregateRaw({ pipeline });
    const errands = this.parseAggregationResults(result);
    const total = await this.getMatchingErrandsCount(userId, maxDistanceKm);
    const page = Math.floor(skip / limit) + 1;

    return this.buildPaginatedResponse(errands, total, page, limit, userId);
  }

  /**
   * Most Recent: Latest errands near user
   */
  async getRecentErrands(
    userId: string,
    skip: number,
    limit: number,
    maxDistanceKm: number,
  ): Promise<PaginatedErrands> {
    const { location, clientId } = await this.getUserActiveAddress(userId);
    const meters = maxDistanceKm * 1000;
    const userLat = location.coordinates[1];
    const userLng = location.coordinates[0];

    const pipeline = [
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
          ...(clientId && { clientId: { $ne: clientId } }),
        },
      },
      {
        $sort: {
          createdAt: -1,
          distance: 1,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    const result = await this.prisma.errand.aggregateRaw({ pipeline });
    const errands = this.parseAggregationResults(result);
    const total = await this.getErrandsCount(userId, maxDistanceKm);
    const page = Math.floor(skip / limit) + 1;

    return this.buildPaginatedResponse(errands, total, page, limit, userId);
  }

  /**
   * Saved: User's bookmarked errands
   */
  async getSavedErrands(
    userId: string,
    skip: number,
    limit: number,
  ): Promise<PaginatedErrands> {
    // Assuming we have a SavedErrand table - adjust based on your schema
    const errands = await this.prisma.errand.findMany({
      where: {
        savedErrands: { some: { userId } },
      },
      include: {
        ratings: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });

    const total = 0; // Replace with actual saved errands count
    const page = Math.floor(skip / limit) + 1;

    return this.buildPaginatedResponse(
      errands.map((e) => ({ ...e, distance: 0 })),
      total,
      page,
      limit,
      userId,
    );
  }

  /**
   * Search: Text search with location filtering
   */
  async searchErrands(
    userId: string,
    keyword: string,
    skip: number,
    limit: number,
    maxDistanceKm: number,
  ): Promise<PaginatedErrands> {
    // Save the search keyword to user's search history (only if keyword is not empty)
    if (keyword && keyword.trim().length > 0) {
      try {
        await this.usersService.saveSearchKeyword(userId, keyword.trim());
      } catch (error) {
        // Log the error but don't fail the search if saving keyword fails
        console.warn('Failed to save search keyword:', error.message);
      }
    }

    const { location } = await this.getUserActiveAddress(userId);
    const meters = maxDistanceKm * 1000;
    const userLat = location.coordinates[1];
    const userLng = location.coordinates[0];

    const pipeline = [
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
          userId: { $ne: userId },
          $or: [
            { title: { $regex: keyword, $options: 'i' } },
            { description: { $regex: keyword, $options: 'i' } },
            { service: { $regex: keyword, $options: 'i' } },
            { profession: { $regex: keyword, $options: 'i' } },
          ],
        },
      },
      {
        $sort: {
          distance: 1,
          createdAt: -1,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    const result = await this.prisma.errand.aggregateRaw({ pipeline });
    const errands = this.parseAggregationResults(result);
    const total = await this.getSearchErrandsCount(
      userId,
      keyword,
      maxDistanceKm,
    );
    const page = Math.floor(skip / limit) + 1;

    return this.buildPaginatedResponse(errands, total, page, limit, userId);
  }

  /**
   * Helper methods for counting
   */
  private async getErrandsCount(
    userId: string,
    maxDistanceKm: number,
  ): Promise<number> {
    const { location, clientId } = await this.getUserActiveAddress(userId);
    const meters = maxDistanceKm * 1000;
    const userLat = location.coordinates[1];
    const userLng = location.coordinates[0];

    const result = await this.prisma.errand.aggregateRaw({
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
            ...(clientId && { clientId: { $ne: clientId } }),
          },
        },
        { $count: 'total' },
      ],
    });

    const countResult = this.parseCountResult(result);
    return countResult[0]?.total || 0;
  }

  private async getMatchingErrandsCount(
    userId: string,
    maxDistanceKm: number,
  ): Promise<number> {
    const { user, location, clientId } =
      await this.getUserActiveAddress(userId);
    const meters = maxDistanceKm * 1000;
    const userLat = location.coordinates[1];
    const userLng = location.coordinates[0];

    const result = await this.prisma.errand.aggregateRaw({
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
            ...(clientId && { clientId: { $ne: clientId } }),
            $or: [
              { service: { $in: user.worker?.services || [] } },
              { profession: user.worker?.workerType },
            ],
          },
        },
        { $count: 'total' },
      ],
    });

    const countResult = this.parseCountResult(result);
    return countResult[0]?.total || 0;
  }

  private async getSearchErrandsCount(
    userId: string,
    keyword: string,
    maxDistanceKm: number,
  ): Promise<number> {
    const { location, clientId } = await this.getUserActiveAddress(userId);
    const meters = maxDistanceKm * 1000;
    const userLat = location.coordinates[1];
    const userLng = location.coordinates[0];

    const result = await this.prisma.errand.aggregateRaw({
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
            ...(clientId && { clientId: { $ne: clientId } }),
            $or: [
              { title: { $regex: keyword, $options: 'i' } },
              { description: { $regex: keyword, $options: 'i' } },
              { service: { $regex: keyword, $options: 'i' } },
              { profession: { $regex: keyword, $options: 'i' } },
            ],
          },
        },
        { $count: 'total' },
      ],
    });

    const countResult = this.parseCountResult(result);
    return countResult[0]?.total || 0;
  }

  /**
   * Calculate distance between two geographic points using Haversine formula
   * Returns distance in meters
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Helper methods to safely parse MongoDB aggregation results
   */
  private parseAggregationResults(result: Prisma.JsonObject): Array<any> {
    // MongoDB aggregateRaw returns results in a format compatible with the expected array
    // We safely cast it since we know the structure from our aggregation pipeline
    const parsed = JSON.parse(JSON.stringify(result)) as Array<any>;

    // Convert MongoDB ObjectId format { $oid: "..." } to plain strings
    return parsed.map((item) => this.convertObjectIds(item));
  }

  /**
   * Recursively convert MongoDB ObjectId format to strings
   */
  private convertObjectIds(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    // Handle ObjectId format { $oid: "..." }
    if (obj.$oid) return obj.$oid;

    // Handle Date format { $date: "..." }
    if (obj.$date) return new Date(obj.$date);

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map((item) => this.convertObjectIds(item));
    }

    // Handle objects - convert all properties recursively
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Map MongoDB's _id to id
      const newKey = key === '_id' ? 'id' : key;
      converted[newKey] = this.convertObjectIds(value);
    }

    return converted;
  }

  private parseCountResult(
    result: Prisma.JsonObject,
  ): Array<{ total: number }> {
    return JSON.parse(JSON.stringify(result)) as Array<{ total: number }>;
  }

  /**
   * Build paginated response
   */
  private async buildPaginatedResponse(
    errands: Array<any>,
    total: number,
    page: number,
    limit: number,
    userId?: string,
  ): Promise<PaginatedErrands> {
    // Enrich each errand with client data, clientName and clientRating
    const enriched = await Promise.all(
      errands.map(async (errand) => {
        // Fetch client user name
        const client = await this.prisma.client.findUnique({
          where: { id: errand.clientId },
          include: { user: true },
        });
        // Calculate average rating for client
        const avg = await this.prisma.rating.aggregate({
          where: { rateeId: errand.clientId },
          _avg: { rating: true },
        });
        // Fetch reviews for this errand
        const reviews = await this.prisma.rating.findMany({
          where: { errandId: errand.id },
        });
        // Check if errand is saved by user
        let isSaved = false;
        if (userId) {
          const savedErrand = await this.prisma.savedErrand.findFirst({
            where: {
              userId,
              errandId: errand.id,
            },
          });
          isSaved = !!savedErrand;
        }
        return {
          ...errand,
          client, // Add the full client object for GraphQL
          clientName: client?.user?.name ?? null,
          clientRating: avg._avg?.rating ?? null,
          distance: errand.distance ?? 0, // Explicitly preserve distance from aggregation
          reviews: reviews || [], // Include reviews or empty array
          isSaved,
        };
      }),
    );
    const totalPages = Math.ceil(total / limit);
    return {
      data: enriched,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}
