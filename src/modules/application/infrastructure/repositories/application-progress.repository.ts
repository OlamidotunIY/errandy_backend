import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  IAcceptApplicationProgressRepository,
  AcceptApplicationProgress,
  ApplicationId,
} from '../../domain';
import { ApplicationMapper } from '../mappers';

@Injectable()
export class PrismaApplicationProgressRepository
  implements IAcceptApplicationProgressRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ApplicationMapper,
  ) {}

  async save(progress: AcceptApplicationProgress): Promise<void> {
    const data = this.mapper.toProgressPersistence(progress);

    await this.prisma.acceptApplicationProgress.upsert({
      where: { applicationId: progress.applicationId.value },
      create: data,
      update: data,
    });
  }

  async findByApplicationId(
    applicationId: ApplicationId,
  ): Promise<AcceptApplicationProgress> {
    const record = await this.prisma.acceptApplicationProgress.findUnique({
      where: { applicationId: applicationId.value },
    });

    if (!record) {
      throw new Error(
        `AcceptApplicationProgress for applicationId ${applicationId.value} not found`,
      );
    }

    return this.mapper.toProgressDomain(record);
  }
}
