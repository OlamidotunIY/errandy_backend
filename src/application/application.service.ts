import { Injectable } from '@nestjs/common';
import { CreateApplicationInput } from './dto/create-application.input';
import { PrismaService } from 'src/prisma.service';
import { AcceptApplicationInput } from './dto/accept-application.input';
import { ApplicationStatus } from './entities/applicationStatus.enum';
import { ErrandStatus } from 'src/errands/entities/errandStatus.enum';
import { ErrandApplicationSummary } from './entities/errand-application-summary.entity';

@Injectable()
export class ApplicationService {
  constructor(private readonly prisma: PrismaService) {}

  async apply(createApplicationInput: CreateApplicationInput, userId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new Error('User does not have a provider profile');
    }

    const errand = await this.prisma.errand.findUnique({
      where: { id: createApplicationInput.errandId },
    });

    if (!errand) {
      throw new Error('Errand not found');
    }

    if (errand.status !== ErrandStatus.OPEN) {
      throw new Error('This errand is not open for applications');
    }

    return this.prisma.application.create({
      data: {
        ...createApplicationInput,
        workerId: provider.id,
        status: 'PENDING',
      },
    });
  }

  async myApplicationForErrand(errandId: string, userId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      return null;
    }

    return this.prisma.application.findUnique({
      where: {
        errandId_workerId: {
          errandId,
          workerId: provider.id,
        },
      },
    });
  }

  async getApplicationById(applicationId: string, userId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new Error('Application not found');
    }

    const errand = await this.prisma.errand.findUnique({
      where: { id: application.errandId },
      include: { client: true },
    });

    if (!errand) {
      throw new Error('Errand not found');
    }

    const client = await this.prisma.client.findUnique({
      where: { userId },
    });

    if (client && client.id === errand.clientId) {
      return application;
    }

    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (provider && provider.id === application.workerId) {
      return application;
    }

    throw new Error('Not authorized to view this application');
  }

  async errandApplications(errandId: string, userId: string) {
    const errand = await this.prisma.errand.findUnique({
      where: { id: errandId },
      include: { client: true },
    });

    if (!errand) {
      throw new Error('Errand not found');
    }

    const client = await this.prisma.client.findUnique({
      where: { userId },
    });

    if (!client || client.id !== errand.clientId) {
      throw new Error('Not authorized to view applications');
    }

    return this.prisma.application.findMany({
      where: { errandId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async errandApplicationSummary(
    errandId: string,
    userId: string,
  ): Promise<ErrandApplicationSummary> {
    const errand = await this.prisma.errand.findUnique({
      where: { id: errandId },
      include: { client: true },
    });

    if (!errand) {
      throw new Error('Errand not found');
    }

    const applications = await this.prisma.application.findMany({
      where: { errandId },
      select: { workerId: true, status: true },
    });

    const totalApplications = applications.length;
    const pendingApplications = applications.filter(
      (a) => a.status === ApplicationStatus.PENDING,
    ).length;
    const acceptedApplications = applications.filter(
      (a) => a.status === ApplicationStatus.ACCEPTED,
    ).length;
    const cancelledApplications = applications.filter(
      (a) => a.status === ApplicationStatus.CANCELLED,
    ).length;
    const rejectedApplications = applications.filter(
      (a) => a.status === ApplicationStatus.REJECTED,
    ).length;

    const appliedWorkerIds = applications
      .filter(
        (a) =>
          a.status === ApplicationStatus.PENDING ||
          a.status === ApplicationStatus.ACCEPTED,
      )
      .map((a) => a.workerId);

    const providers =
      appliedWorkerIds.length > 0
        ? await this.prisma.provider.findMany({
            where: { id: { in: appliedWorkerIds } },
            select: { userId: true },
          })
        : [];

    const clientUserId = errand.client?.userId;
    let chattingApplicants = 0;
    if (clientUserId && providers.length > 0) {
      const rooms = await this.prisma.chatRoom.findMany({
        where: { participantIds: { has: clientUserId } },
        select: { participantIds: true },
      });

      const chattingWith = new Set<string>();
      for (const room of rooms) {
        for (const participantId of room.participantIds) {
          if (participantId !== clientUserId) {
            chattingWith.add(participantId);
          }
        }
      }

      chattingApplicants = providers.filter((p) => chattingWith.has(p.userId))
        .length;
    }

    const myApplication = await this.myApplicationForErrand(errandId, userId);
    const statusMap: Partial<Record<string, ApplicationStatus>> = {
      PENDING: ApplicationStatus.PENDING,
      ACCEPTED: ApplicationStatus.ACCEPTED,
      REJECTED: ApplicationStatus.REJECTED,
      CANCELLED: ApplicationStatus.CANCELLED,
    };

    return {
      totalApplications,
      pendingApplications,
      acceptedApplications,
      cancelledApplications,
      rejectedApplications,
      chattingApplicants,
      myApplicationStatus: myApplication?.status
        ? statusMap[myApplication.status]
        : undefined,
    };
  }

  async acceptApplication(input: AcceptApplicationInput, userId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: input.applicationId },
    });

    if (!application) {
      throw new Error('Application not found');
    }

    if (application.status !== ApplicationStatus.PENDING) {
      throw new Error('Only pending applications can be accepted');
    }

    const errand = await this.prisma.errand.findUnique({
      where: { id: application.errandId },
      include: { client: true },
    });

    if (!errand) {
      throw new Error('Errand not found');
    }

    const client = await this.prisma.client.findUnique({
      where: { userId },
    });

    if (!client || client.id !== errand.clientId) {
      throw new Error('Not authorized to accept this application');
    }

    if (errand.status !== ErrandStatus.OPEN) {
      throw new Error('Only open errands can accept applications');
    }

    const existingAccepted = await this.prisma.application.findFirst({
      where: {
        errandId: errand.id,
        status: ApplicationStatus.ACCEPTED,
      },
    });

    if (existingAccepted) {
      throw new Error('This errand already has an accepted application');
    }

    if (input.paymentMethodId) {
      const paymentMethod = await this.prisma.paymentMethod.findUnique({
        where: { id: input.paymentMethodId },
      });

      if (!paymentMethod || paymentMethod.userId !== client.id) {
        throw new Error('Invalid payment method');
      }

      if (!paymentMethod.verified) {
        throw new Error('Payment method is not verified');
      }
    }

    const acceptedAt = new Date();

    const [, updatedErrand] = await this.prisma.$transaction([
      this.prisma.application.update({
        where: { id: application.id },
        data: {
          status: ApplicationStatus.ACCEPTED,
          acceptedAt,
        },
      }),
      this.prisma.errand.update({
        where: { id: errand.id },
        data: {
          status: ErrandStatus.IN_PROGRESS,
          assignedTo: application.workerId,
          assignedAt: acceptedAt,
        },
      }),
      this.prisma.application.updateMany({
        where: {
          errandId: errand.id,
          id: { not: application.id },
          status: ApplicationStatus.PENDING,
        },
        data: {
          status: ApplicationStatus.CANCELLED,
        },
      }),
    ]);

    return updatedErrand;
  }
}
