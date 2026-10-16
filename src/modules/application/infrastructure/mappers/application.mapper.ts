import { Injectable } from '@nestjs/common';
import {
  Application as PrismaApplication,
  AcceptApplicationProgress as PrismaProgress,
  AppStatus,
  ApplicationType as PrismaAppType,
  Prisma,
} from '@prisma/client';
import {
  Application,
  AcceptApplicationProgress,
  ApplicationId,
  AcceptApplicationProgressId,
  ApplicationStatus,
  ApplicationType,
  AcceptApplicationProgressStatus,
} from '../../domain';
import { PartyId } from '@module/party';
import { ErrandId } from '@module/errands';

const APP_STATUS_TO_DOMAIN: Record<AppStatus, ApplicationStatus> = {
  [AppStatus.PENDING]: ApplicationStatus.PENDING,
  [AppStatus.ACCEPTED]: ApplicationStatus.ACCEPTED,
  [AppStatus.REJECTED]: ApplicationStatus.REJECTED,
  [AppStatus.CANCELLED]: ApplicationStatus.CANCELLED,
};

const APP_STATUS_TO_PRISMA: Record<ApplicationStatus, AppStatus> = {
  [ApplicationStatus.PENDING]: AppStatus.PENDING,
  [ApplicationStatus.ACCEPTED]: AppStatus.ACCEPTED,
  [ApplicationStatus.REJECTED]: AppStatus.REJECTED,
  [ApplicationStatus.CANCELLED]: AppStatus.CANCELLED,
};

const APP_TYPE_TO_DOMAIN: Record<PrismaAppType, ApplicationType> = {
  [PrismaAppType.PROVIDER]: ApplicationType.PROVIDER,
  [PrismaAppType.ORGANIZATION]: ApplicationType.ORGANIZATION,
};

const APP_TYPE_TO_PRISMA: Record<ApplicationType, PrismaAppType> = {
  [ApplicationType.PROVIDER]: PrismaAppType.PROVIDER,
  [ApplicationType.ORGANIZATION]: PrismaAppType.ORGANIZATION,
  [ApplicationType.DIRECT_OFFER]: PrismaAppType.PROVIDER,
};

const PROGRESS_STATUS_TO_STRING: Record<
  AcceptApplicationProgressStatus,
  string
> = {
  [AcceptApplicationProgressStatus.CHARGE_INITIATED]: 'CHARGE_INITIATED',
  [AcceptApplicationProgressStatus.CHARGE_FAILED]: 'CHARGE_FAILED',
  [AcceptApplicationProgressStatus.ACCEPTED]: 'ACCEPTED',
  [AcceptApplicationProgressStatus.ASSIGNED]: 'ASSIGNED',
  [AcceptApplicationProgressStatus.ESCROW_CREATED]: 'ESCROW_CREATED',
  [AcceptApplicationProgressStatus.COMPLETED]: 'COMPLETED',
};

const STRING_TO_PROGRESS_STATUS: Record<
  string,
  AcceptApplicationProgressStatus
> = {
  CHARGE_INITIATED: AcceptApplicationProgressStatus.CHARGE_INITIATED,
  CHARGE_FAILED: AcceptApplicationProgressStatus.CHARGE_FAILED,
  ACCEPTED: AcceptApplicationProgressStatus.ACCEPTED,
  ASSIGNED: AcceptApplicationProgressStatus.ASSIGNED,
  ERRAND_ASSIGNED: AcceptApplicationProgressStatus.ASSIGNED,
  ESCROW_CREATED: AcceptApplicationProgressStatus.ESCROW_CREATED,
  COMPLETED: AcceptApplicationProgressStatus.COMPLETED,
};

@Injectable()
export class ApplicationMapper {
  toDomain(record: PrismaApplication): Application {
    return Application.reconstitute({
      id: ApplicationId.fromString(record.id),
      errandId: ErrandId.fromString(record.errandId),
      providerPartyId: PartyId.fromString(record.providerPartyId),
      status: APP_STATUS_TO_DOMAIN[record.status] ?? ApplicationStatus.PENDING,
      type: APP_TYPE_TO_DOMAIN[record.applicantType] ?? ApplicationType.PROVIDER,
      proposal: record.proposal,
      proposedAmountMinorUnits: record.proposedAmountMinorUnits,
      currency: record.currency,
      acceptedAt: record.acceptedAt,
      rejectedAt: record.rejectedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  toPersistence(application: Application): Prisma.ApplicationUncheckedCreateInput {
    return {
      id: application.id.value,
      errandId: application.errandId.value,
      providerPartyId: application.providerPartyId.value,
      applicantType: APP_TYPE_TO_PRISMA[application.type()] ?? PrismaAppType.PROVIDER,
      status: APP_STATUS_TO_PRISMA[application.status()] ?? AppStatus.PENDING,
      proposal: application.proposal(),
      proposedAmountMinorUnits: application.proposedAmountMinorUnits(),
      currency: application.currency(),
      acceptedAt: application.acceptedAt(),
      rejectedAt: application.rejectedAt(),
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }

  toProgressDomain(record: PrismaProgress): AcceptApplicationProgress {
    return new AcceptApplicationProgress(
      AcceptApplicationProgressId.fromString(record.id),
      ApplicationId.fromString(record.applicationId),
      ErrandId.fromString(record.errandId),
      record.correlationId,
      STRING_TO_PROGRESS_STATUS[record.status] ??
        AcceptApplicationProgressStatus.CHARGE_INITIATED,
      record.gatewayReference,
      record.createdAt,
      record.updatedAt,
    );
  }

  toProgressPersistence(
    progress: AcceptApplicationProgress,
  ): Prisma.AcceptApplicationProgressUncheckedCreateInput {
    return {
      id: progress.id.value,
      applicationId: progress.applicationId.value,
      errandId: progress.errandId.value,
      correlationId: progress.correlationId,
      gatewayReference: progress.gatewayReference,
      status:
        PROGRESS_STATUS_TO_STRING[progress.status()] ?? 'CHARGE_INITIATED',
      createdAt: progress.createdAt,
      updatedAt: progress.updatedAt,
    };
  }
}
