import { Injectable } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import {
  IVerificationRepository,
  VerificationProfile,
  VerificationProfileProps,
} from '../../domain';

@Injectable()
export class PrismaVerificationRepository implements IVerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<VerificationProfile | null> {
    const record = await this.prisma.verificationProfile.findUnique({
      where: { id },
    });
    if (!record) return null;
    return new VerificationProfile(record as VerificationProfileProps);
  }

  async findByPartyId(partyId: string): Promise<VerificationProfile | null> {
    const record = await this.prisma.verificationProfile.findUnique({
      where: { partyId },
    });
    if (!record) return null;
    return new VerificationProfile(record as VerificationProfileProps);
  }

  async save(profile: VerificationProfile): Promise<void> {
    const data = profile.toPrimitives();
    await this.prisma.verificationProfile.upsert({
      where: { partyId: data.partyId },
      create: {
        id: data.id,
        partyId: data.partyId,
        overallStatus: data.overallStatus,
        steps: data.steps.map((s) => ({
          stepType: s.stepType,
          status: s.status,
          documentUrls: s.documentUrls,
          submittedAt: s.submittedAt ?? null,
          reviewedAt: s.reviewedAt ?? null,
          reviewerId: s.reviewerId ?? null,
          rejectionReason: s.rejectionReason ?? null,
        })),
      },
      update: {
        overallStatus: data.overallStatus,
        steps: data.steps.map((s) => ({
          stepType: s.stepType,
          status: s.status,
          documentUrls: s.documentUrls,
          submittedAt: s.submittedAt ?? null,
          reviewedAt: s.reviewedAt ?? null,
          reviewerId: s.reviewerId ?? null,
          rejectionReason: s.rejectionReason ?? null,
        })),
      },
    });
  }
}
