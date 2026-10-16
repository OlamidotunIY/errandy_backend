import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import {
  ITrustedCircleRepository,
  TrustedCircle,
  TrustedCircleProps,
} from '../../domain';

@Injectable()
export class PrismaTrustedCircleRepository implements ITrustedCircleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<TrustedCircle | null> {
    const record = await this.prisma.trustedCircle.findUnique({
      where: { id },
    });
    if (!record) return null;
    return new TrustedCircle(record as unknown as TrustedCircleProps);
  }

  async findByOwnerPartyId(
    ownerPartyId: string,
  ): Promise<TrustedCircle | null> {
    const record = await this.prisma.trustedCircle.findUnique({
      where: { ownerPartyId },
    });
    if (!record) return null;
    return new TrustedCircle(record as unknown as TrustedCircleProps);
  }

  async save(circle: TrustedCircle): Promise<void> {
    const data = circle.toPrimitives();
    await this.prisma.trustedCircle.upsert({
      where: { ownerPartyId: data.ownerPartyId },
      create: {
        id: data.id,
        ownerPartyId: data.ownerPartyId,
        members: data.members.map((m) => ({
          memberId: m.memberId,
          status: m.status,
          sharedFromPartyId: m.sharedFromPartyId ?? null,
          addedAt: m.addedAt ?? null,
        })),
      },
      update: {
        members: data.members.map((m) => ({
          memberId: m.memberId,
          status: m.status,
          sharedFromPartyId: m.sharedFromPartyId ?? null,
          addedAt: m.addedAt ?? null,
        })),
      },
    });
  }
}
