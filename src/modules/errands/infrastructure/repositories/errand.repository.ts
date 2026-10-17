import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  IErrandRepository,
  Errand,
  ErrandAssignment,
  ErrandStatus,
} from '../../domain';
import { ErrandMapper } from '../mappers';

const TIER_RANK: Record<string, number> = {
  COMMUNITY: 0,
  VERIFIED: 1,
  CERTIFIED: 2,
};

@Injectable()
export class PrismaErrandRepository implements IErrandRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ErrandMapper,
  ) {}

  async save(errand: Errand): Promise<void> {
    const data = this.mapper.toPersistence(errand);

    await this.prisma.errand.upsert({
      where: { id: errand.id.value },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<Errand | null> {
    const record = await this.prisma.errand.findUnique({
      where: { id },
    });

    return record ? this.mapper.toDomain(record) : null;
  }

  async findByClientId(clientPartyId: string): Promise<Errand[]> {
    const records = await this.prisma.errand.findMany({
      where: { clientId: clientPartyId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.mapper.toDomain(r));
  }

  async findByProviderId(providerPartyId: string): Promise<Errand[]> {
    const assignments = await this.prisma.errandAssignment.findMany({
      where: { profileId: providerPartyId },
      select: { errandId: true },
    });
    const errandIds = assignments.map((a) => a.errandId);
    if (errandIds.length === 0) {
      return [];
    }
    const records = await this.prisma.errand.findMany({
      where: { id: { in: errandIds } },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.mapper.toDomain(r));
  }

  async findOpenErrands(filters: {
    marketId: string;
    categoryId?: string;
    requesterTier: string;
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
    limit?: number;
  }): Promise<Errand[]> {
    const where: any = {
      marketId: filters.marketId,
      status: ErrandStatus.PUBLISHED,
    };

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    const records = await this.prisma.errand.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit ? filters.limit * 2 : 50,
    });

    const userTierRank = TIER_RANK[filters.requesterTier] ?? 0;

    let results = records
      .map((r) => this.mapper.toDomain(r))
      .filter((errand) => {
        const requiredRank = TIER_RANK[errand.requiredTier] ?? 0;
        return userTierRank >= requiredRank;
      });

    if (
      filters.latitude !== undefined &&
      filters.longitude !== undefined &&
      filters.radiusMeters !== undefined
    ) {
      results = results.filter((errand) => {
        const dist = errand.distanceInMetersFrom(
          filters.latitude!,
          filters.longitude!,
        );
        return dist !== null && dist <= filters.radiusMeters!;
      });
    }

    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  async findAssignedPastStart(): Promise<Errand[]> {
    const records = await this.prisma.errand.findMany({
      where: {
        status: ErrandStatus.ASSIGNED,
        expectedStartAt: {
          lte: new Date(),
        },
      },
    });

    return records.map((r) => this.mapper.toDomain(r));
  }

  async findInactiveOlderThan(date: Date): Promise<Errand[]> {
    const records = await this.prisma.errand.findMany({
      where: {
        status: ErrandStatus.DRAFT,
        updatedAt: {
          lte: date,
        },
      },
    });

    return records.map((r) => this.mapper.toDomain(r));
  }

  async saveAssignment(assignment: ErrandAssignment): Promise<void> {
    const data = this.mapper.toAssignmentPersistence(assignment);

    await this.prisma.errandAssignment.upsert({
      where: { id: assignment.id.value },
      create: data,
      update: data,
    });
  }

  async findAssignmentsByErrandId(
    errandId: string,
  ): Promise<ErrandAssignment[]> {
    const records = await this.prisma.errandAssignment.findMany({
      where: { errandId },
    });

    return records.map((r) => this.mapper.toAssignmentDomain(r));
  }

  async findAssignmentById(id: string): Promise<ErrandAssignment | null> {
    const record = await this.prisma.errandAssignment.findUnique({
      where: { id },
    });

    return record ? this.mapper.toAssignmentDomain(record) : null;
  }
}
