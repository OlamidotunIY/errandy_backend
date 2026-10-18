import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  IApplicationRepository,
  Application,
  ApplicationId,
} from '../../domain';
import { ApplicationMapper } from '../mappers';
import { PartyId } from '@module/party';
import { ErrandId } from '@module/errands';
import { AppStatus } from '@prisma/client';

@Injectable()
export class PrismaApplicationRepository implements IApplicationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ApplicationMapper,
  ) {}

  async save(application: Application): Promise<void> {
    const data = this.mapper.toPersistence(application);

    await this.prisma.application.upsert({
      where: { id: application.id.value },
      create: data,
      update: data,
    });
  }

  async findById(id: ApplicationId): Promise<Application | null> {
    const record = await this.prisma.application.findUnique({
      where: { id: id.value },
    });

    return record ? this.mapper.toDomain(record) : null;
  }

  async findByErrandId(errandId: ErrandId): Promise<Application[]> {
    const records = await this.prisma.application.findMany({
      where: { errandId: errandId.value },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.mapper.toDomain(r));
  }

  async findByWorkerId(providerPartyId: PartyId): Promise<Application[]> {
    const records = await this.prisma.application.findMany({
      where: { providerPartyId: providerPartyId.value },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.mapper.toDomain(r));
  }

  async findPendingByErrandId(errandId: ErrandId): Promise<Application[]> {
    const records = await this.prisma.application.findMany({
      where: {
        errandId: errandId.value,
        status: AppStatus.PENDING,
      },
    });

    return records.map((r) => this.mapper.toDomain(r));
  }

  async existsByErrandAndWorker(
    errandId: ErrandId,
    providerPartyId: PartyId,
  ): Promise<boolean> {
    const count = await this.prisma.application.count({
      where: {
        errandId: errandId.value,
        providerPartyId: providerPartyId.value,
      },
    });

    return count > 0;
  }
}
