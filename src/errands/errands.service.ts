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
import { GetMyErrandsInput } from './dto/get-my-errands.input';
import { MyErrandsType } from './dto/my-errands-type.enum';
import { ErrandStatus } from './entities/errandStatus.enum';
import { ApplicationStatus } from 'src/application/entities/applicationStatus.enum';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

export interface ErrandUpdatedEvent {
  errandId: string;
  clientId: string;
  serviceAddress?: string;
}

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
    private readonly eventEmitter: EventEmitter2,
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

    // Get user's active address + providerType + skills
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      include: {
        activeAddress: true,
        provider: {
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
    if (user?.provider?.services?.length) {
      priorityMatch.service = { $in: user.provider.services };
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
              providerType: user.provider?.providerType,
            },
          },
          {
            $addFields: {
              priority: {
                $cond: [
                  {
                    $or: priorityMatch.service
                      ? [{ $in: ['$service', user.provider?.services] }]
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
            ...(user.provider?.providerType && {
              providerType: user.provider.providerType,
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

    // Emit NestJS event for internal processing
    this.eventEmitter.emit('errand.updated', {
      errandId: errand.id,
      clientId: errand.clientId,
      serviceAddress: updateErrandInput.serviceAddress,
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

  @OnEvent('errand.updated')
  async handleErrandUpdated(payload: ErrandUpdatedEvent) {
    if (!payload.serviceAddress) return;

    // Get the client's user record to find their registered addresses
    const client = await this.prisma.client.findUnique({
      where: { id: payload.clientId },
      include: {
        user: {
          include: {
            userAddress: true,
          },
        },
      },
    });

    if (!client?.user?.userAddress) return;

    // Find the address that matches the errand's serviceAddress
    const matchedAddress = client.user.userAddress.find(
      (addr) => addr.address === payload.serviceAddress,
    );

    if (matchedAddress && matchedAddress.location) {
      const location = matchedAddress.location as any;
      await this.updateLocation({
        id: payload.errandId,
        serviceAddress: payload.serviceAddress,
        latitude: location.coordinates[1].toString(),
        longitude: location.coordinates[0].toString(),
      });
      console.log(
        `✅ Updated location for errand ${payload.errandId} using address from ${payload.serviceAddress}`,
      );
    }
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
        provider: {
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
    if (user?.provider?.services?.length) {
      priorityMatch.service = { $in: user.provider.services };
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
                  ? [{ $in: ['$service', user.provider?.services] }]
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
            { service: { $in: user.provider?.services || [] } },
            { profession: user.provider?.providerType },
          ],
        },
      },
      {
        $addFields: {
          matchScore: {
            $add: [
              {
                $cond: [
                  { $in: ['$service', user.provider?.services || []] },
                  2,
                  0,
                ],
              },
              {
                $cond: [
                  { $eq: ['$profession', user.provider?.providerType] },
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
              { service: { $in: user.provider?.services || [] } },
              { profession: user.provider?.providerType },
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

  /**
   * Get My Errands - Returns errands based on user role
   * Clients: Get errands they created (Active, Published, Draft)
   * Providers: Get errands they applied for (Active, Pending, Rejected, Completed)
   */
  async getMyErrands(
    input: GetMyErrandsInput,
    userId: string,
  ): Promise<PaginatedErrands> {
    const { type, pagination } = input;
    const { page = 1, limit = 10 } = pagination || {};
    const skip = (page - 1) * limit;

    switch (type) {
      // Client tabs - errands they created
      case MyErrandsType.CLIENT_ACTIVE:
        return this.getClientErrands(
          userId,
          [ErrandStatus.IN_PROGRESS],
          skip,
          limit,
        );
      case MyErrandsType.CLIENT_PUBLISHED:
        return this.getClientErrands(userId, [ErrandStatus.OPEN], skip, limit);
      case MyErrandsType.CLIENT_DRAFT:
        return this.getClientErrands(userId, [ErrandStatus.DRAFT], skip, limit);

      // Provider tabs - errands they applied for
      case MyErrandsType.PROVIDER_ACTIVE:
        return this.getProviderAppliedErrands(
          userId,
          ApplicationStatus.ACCEPTED,
          [ErrandStatus.IN_PROGRESS],
          skip,
          limit,
        );
      case MyErrandsType.PROVIDER_PENDING:
        return this.getProviderAppliedErrands(
          userId,
          ApplicationStatus.PENDING,
          null,
          skip,
          limit,
        );
      case MyErrandsType.PROVIDER_REJECTED:
        return this.getProviderRejectedErrands(userId, skip, limit);
      case MyErrandsType.PROVIDER_COMPLETED:
        return this.getProviderAppliedErrands(
          userId,
          ApplicationStatus.ACCEPTED,
          [ErrandStatus.COMPLETED],
          skip,
          limit,
        );

      default:
        throw new Error(`Invalid MyErrandsType: ${type}`);
    }
  }

  /**
   * Get errands created by a client
   */
  private async getClientErrands(
    userId: string,
    statuses: ErrandStatus[],
    skip: number,
    limit: number,
  ): Promise<PaginatedErrands> {
    // Get the client ID for this user
    const client = await this.prisma.client.findUnique({
      where: { userId },
    });

    if (!client) {
      return {
        data: [],
        total: 0,
        page: Math.floor(skip / limit) + 1,
        limit,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    }

    const whereClause = {
      clientId: client.id,
      status: { in: statuses },
    };

    const [errands, total] = await Promise.all([
      this.prisma.errand.findMany({
        where: whereClause,
        include: {
          service: true,
          client: {
            include: {
              user: true,
            },
          },
          ratings: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.errand.count({ where: whereClause }),
    ]);

    const page = Math.floor(skip / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    return {
      data: errands.map((e) => ({
        ...e,
        distance: 0,
        clientName: e.client?.user?.name ?? null,
        clientRating: null,
        isSaved: false,
      })) as any,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Get errands that a provider has applied for with specific application status
   */
  private async getProviderAppliedErrands(
    userId: string,
    applicationStatus: ApplicationStatus,
    errandStatuses: ErrandStatus[] | null,
    skip: number,
    limit: number,
  ): Promise<PaginatedErrands> {
    // Get the provider/worker ID for this user
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      return {
        data: [],
        total: 0,
        page: Math.floor(skip / limit) + 1,
        limit,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    }

    // Find applications for this provider
    const applicationWhereClause: any = {
      workerId: provider.id,
      status: applicationStatus,
    };

    const applications = await this.prisma.application.findMany({
      where: applicationWhereClause,
      select: { errandId: true },
    });

    const errandIds = applications.map((a) => a.errandId);

    if (errandIds.length === 0) {
      return {
        data: [],
        total: 0,
        page: Math.floor(skip / limit) + 1,
        limit,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    }

    const errandWhereClause: any = {
      id: { in: errandIds },
    };

    // If errand statuses are specified, filter by them
    if (errandStatuses && errandStatuses.length > 0) {
      errandWhereClause.status = { in: errandStatuses };
    }

    const [errands, total] = await Promise.all([
      this.prisma.errand.findMany({
        where: errandWhereClause,
        include: {
          service: true,
          client: {
            include: {
              user: true,
            },
          },
          ratings: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.errand.count({ where: errandWhereClause }),
    ]);

    const page = Math.floor(skip / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    return {
      data: errands.map((e) => ({
        ...e,
        distance: 0,
        clientName: e.client?.user?.name ?? null,
        clientRating: null,
        isSaved: false,
      })) as any,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Get errands where provider's application was rejected or cancelled
   */
  private async getProviderRejectedErrands(
    userId: string,
    skip: number,
    limit: number,
  ): Promise<PaginatedErrands> {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      return {
        data: [],
        total: 0,
        page: Math.floor(skip / limit) + 1,
        limit,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    }

    // Find rejected or cancelled applications
    const applications = await this.prisma.application.findMany({
      where: {
        workerId: provider.id,
        status: { in: ['REJECTED', 'CANCELLED'] },
      },
      select: { errandId: true },
    });

    const errandIds = applications.map((a) => a.errandId);

    if (errandIds.length === 0) {
      return {
        data: [],
        total: 0,
        page: Math.floor(skip / limit) + 1,
        limit,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    }

    const whereClause = {
      id: { in: errandIds },
    };

    const [errands, total] = await Promise.all([
      this.prisma.errand.findMany({
        where: whereClause,
        include: {
          service: true,
          client: {
            include: {
              user: true,
            },
          },
          ratings: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.errand.count({ where: whereClause }),
    ]);

    const page = Math.floor(skip / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    return {
      data: errands.map((e) => ({
        ...e,
        distance: 0,
        clientName: e.client?.user?.name ?? null,
        clientRating: null,
        isSaved: false,
      })) as any,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  // ==========================================
  // ERRAND TEMPLATE METHODS
  // ==========================================

  async createTemplate(
    input: {
      title: string;
      description?: string;
      pricingType: any;
      price?: number;
      hourlyRate?: number;
      serviceId?: string;
      providerType?: any;
      serviceAddress?: string;
      location?: any;
    },
    userId: string,
  ) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) {
      throw new Error('Client not found');
    }

    return this.prisma.errandTemplate.create({
      data: {
        ...input,
      },
    });
  }

  async updateTemplate(input: {
    id: string;
    title?: string;
    description?: string;
    pricingType?: any;
    price?: number;
    hourlyRate?: number;
    serviceId?: string;
    providerType?: any;
    serviceAddress?: string;
    location?: any;
  }) {
    const { id, ...updateData } = input;
    return this.prisma.errandTemplate.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteTemplate(id: string) {
    // Check if template is in use by recurring errands
    const recurringCount = await this.prisma.recurringErrand.count({
      where: { templateId: id },
    });
    if (recurringCount > 0) {
      throw new Error(
        'Cannot delete template that is in use by recurring errands',
      );
    }

    return this.prisma.errandTemplate.delete({ where: { id } });
  }

  async getMyTemplates(userId: string) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) {
      throw new Error('Client not found');
    }

    // Templates don't have a clientId field in the schema,
    // so we return all templates for now (could add clientId to schema)
    return this.prisma.errandTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTemplateById(id: string) {
    return this.prisma.errandTemplate.findUnique({ where: { id } });
  }

  async createErrandFromTemplate(
    templateId: string,
    userId: string,
    overrides?: {
      title?: string;
      description?: string;
      serviceAddress?: string;
    },
  ) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) {
      throw new Error('Client not found');
    }

    const template = await this.prisma.errandTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      throw new Error('Template not found');
    }

    return this.prisma.errand.create({
      data: {
        title: overrides?.title || template.title,
        description: overrides?.description || template.description,
        pricingType: template.pricingType,
        price: template.price,
        hourlyRate: template.hourlyRate,
        serviceId: template.serviceId,
        providerType: template.providerType,
        serviceAddress: overrides?.serviceAddress || template.serviceAddress,
        location: template.location,
        templateId: template.id,
        clientId: client.id,
      },
      include: { client: true },
    });
  }

  // ==========================================
  // RECURRING ERRAND METHODS
  // ==========================================

  async createRecurringErrand(
    input: {
      templateId: string;
      frequency: any;
      startDate?: Date;
    },
    userId: string,
  ) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) {
      throw new Error('Client not found');
    }

    const template = await this.prisma.errandTemplate.findUnique({
      where: { id: input.templateId },
    });
    if (!template) {
      throw new Error('Template not found');
    }

    const nextRunAt = this.calculateNextRunDate(
      input.frequency,
      input.startDate || new Date(),
    );

    return this.prisma.recurringErrand.create({
      data: {
        clientId: client.id,
        templateId: input.templateId,
        frequency: input.frequency,
        nextRunAt,
        active: true,
      },
      include: { template: true },
    });
  }

  async updateRecurringErrand(input: {
    id: string;
    frequency?: any;
    active?: boolean;
  }) {
    const { id, ...updateData } = input;

    // Recalculate nextRunAt if frequency changed
    if (updateData.frequency) {
      const current = await this.prisma.recurringErrand.findUnique({
        where: { id },
      });
      if (current) {
        (updateData as any).nextRunAt = this.calculateNextRunDate(
          updateData.frequency,
          new Date(),
        );
      }
    }

    return this.prisma.recurringErrand.update({
      where: { id },
      data: updateData,
      include: { template: true },
    });
  }

  async cancelRecurringErrand(id: string) {
    return this.prisma.recurringErrand.update({
      where: { id },
      data: { active: false },
    });
  }

  async deleteRecurringErrand(id: string) {
    return this.prisma.recurringErrand.delete({ where: { id } });
  }

  async getMyRecurringErrands(userId: string) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) {
      throw new Error('Client not found');
    }

    return this.prisma.recurringErrand.findMany({
      where: { clientId: client.id },
      include: { template: true },
      orderBy: { nextRunAt: 'asc' },
    });
  }

  private calculateNextRunDate(
    frequency: 'WEEKLY' | 'MONTHLY',
    fromDate: Date,
  ): Date {
    const date = new Date(fromDate);
    if (frequency === 'WEEKLY') {
      date.setDate(date.getDate() + 7);
    } else if (frequency === 'MONTHLY') {
      date.setMonth(date.getMonth() + 1);
    }
    return date;
  }

  // ==========================================
  // ERRAND BUNDLE METHODS
  // ==========================================

  async createBundle(
    input: {
      name: string;
      description: string;
      basePrice: number;
      templateIds?: string[];
    },
    userId: string,
  ) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) {
      throw new Error('Client not found');
    }

    const bundle = await this.prisma.errandBundle.create({
      data: {
        name: input.name,
        description: input.description,
        basePrice: input.basePrice,
        active: true,
      },
    });

    // Add templates as bundle items if provided
    if (input.templateIds?.length) {
      await Promise.all(
        input.templateIds.map((templateId) =>
          this.prisma.bundleItem.create({
            data: {
              bundleId: bundle.id,
              templateId,
            },
          }),
        ),
      );
    }

    return this.prisma.errandBundle.findUnique({
      where: { id: bundle.id },
      include: { items: { include: { template: true } } },
    });
  }

  async updateBundle(input: {
    id: string;
    name?: string;
    description?: string;
    basePrice?: number;
    active?: boolean;
  }) {
    const { id, ...updateData } = input;
    return this.prisma.errandBundle.update({
      where: { id },
      data: updateData,
      include: { items: { include: { template: true } } },
    });
  }

  async deleteBundle(id: string) {
    // Delete bundle items first
    await this.prisma.bundleItem.deleteMany({ where: { bundleId: id } });
    return this.prisma.errandBundle.delete({ where: { id } });
  }

  async addBundleItem(bundleId: string, templateId: string) {
    // Check if already exists
    const existing = await this.prisma.bundleItem.findFirst({
      where: { bundleId, templateId },
    });
    if (existing) {
      throw new Error('Template already in bundle');
    }

    return this.prisma.bundleItem.create({
      data: { bundleId, templateId },
      include: { template: true },
    });
  }

  async removeBundleItem(bundleId: string, templateId: string) {
    const item = await this.prisma.bundleItem.findFirst({
      where: { bundleId, templateId },
    });
    if (!item) {
      throw new Error('Item not found in bundle');
    }

    return this.prisma.bundleItem.delete({ where: { id: item.id } });
  }

  async getBundles() {
    return this.prisma.errandBundle.findMany({
      where: { active: true },
      include: { items: { include: { template: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getBundleById(id: string) {
    return this.prisma.errandBundle.findUnique({
      where: { id },
      include: { items: { include: { template: true } } },
    });
  }

  async createErrandsFromBundle(
    bundleId: string,
    userId: string,
    serviceAddress?: string,
  ) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) {
      throw new Error('Client not found');
    }

    const bundle = await this.prisma.errandBundle.findUnique({
      where: { id: bundleId },
      include: { items: { include: { template: true } } },
    });
    if (!bundle) {
      throw new Error('Bundle not found');
    }

    const errands = await Promise.all(
      bundle.items.map((item) =>
        this.createErrandFromTemplate(item.templateId, userId, {
          serviceAddress,
        }),
      ),
    );

    return errands;
  }
}
