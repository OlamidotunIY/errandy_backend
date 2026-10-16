import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import {
  Dispute,
  DisputeProps,
  DisputeStatus,
  IDisputeRepository,
} from '../../domain';

@Injectable()
export class PrismaDisputeRepository implements IDisputeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Dispute | null> {
    const record = await this.prisma.dispute.findUnique({
      where: { id },
    });
    if (!record) return null;
    return new Dispute(record as unknown as DisputeProps);
  }

  async findByErrandId(errandId: string): Promise<Dispute[]> {
    const records = await this.prisma.dispute.findMany({
      where: { errandId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => new Dispute(r as unknown as DisputeProps));
  }

  async findByRaisedById(raisedById: string): Promise<Dispute[]> {
    const records = await this.prisma.dispute.findMany({
      where: { raisedById },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => new Dispute(r as unknown as DisputeProps));
  }

  async findAll(status?: DisputeStatus, limit = 50): Promise<Dispute[]> {
    const records = await this.prisma.dispute.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return records.map((r) => new Dispute(r as unknown as DisputeProps));
  }

  async save(dispute: Dispute): Promise<void> {
    const data = dispute.toPrimitives();
    await this.prisma.dispute.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        errandId: data.errandId,
        raisedById: data.raisedById,
        reason: data.reason,
        description: data.description,
        evidenceUrls: data.evidenceUrls,
        status: data.status as any,
        resolution: data.resolution ?? null,
        resolvedById: data.resolvedById ?? null,
        resolvedAt: data.resolvedAt ?? null,
      },
      update: {
        status: data.status as any,
        resolution: data.resolution ?? null,
        resolvedById: data.resolvedById ?? null,
        resolvedAt: data.resolvedAt ?? null,
      },
    });
  }
}
