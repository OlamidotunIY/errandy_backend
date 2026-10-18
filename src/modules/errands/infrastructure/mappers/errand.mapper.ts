import { Injectable } from '@nestjs/common';
import {
  Errand as PrismaErrand,
  ErrandAssignment as PrismaErrandAssignment,
  Prisma,
} from '@prisma/client';
import {
  Errand,
  ErrandAssignment,
  ErrandId,
  ErrandAssignmentId,
  ErrandStatus,
  SourceType,
  CompletedBy,
  AssignmentStatus,
} from '../../domain';
import { Currency, Money } from '@module/escrow/domain';

@Injectable()
export class ErrandMapper {
  toDomain(record: PrismaErrand): Errand {
    const budgetMoney = Money.fromMinorUnits(
      record.budget.amountMinorUnits,
      record.budget.currency as Currency,
    );

    return new Errand(
      ErrandId.fromString(record.id),
      record.clientId,
      record.categoryId,
      record.title,
      record.description,
      record.addressId,
      record.location,
      budgetMoney,
      record.status as ErrandStatus,
      record.sourceType as SourceType,
      record.requiredTier,
      record.marketId,
      record.serviceId ?? undefined,
      record.acceptedApplicationId ?? undefined,
      record.workerPoolPercentageOverride ?? undefined,
      record.startedAt ?? undefined,
      record.completedAt ?? undefined,
      (record.completedBy as CompletedBy) ?? undefined,
      record.cancelledAt ?? undefined,
      record.relistedFromErrandId ?? undefined,
      record.createdAt,
      record.updatedAt,
    );
  }

  toPersistence(errand: Errand): Prisma.ErrandUncheckedCreateInput {
    return {
      id: errand.id.value,
      clientId: errand.clientPartyId,
      serviceId: errand.serviceId ?? null,
      categoryId: errand.categoryId,
      title: errand.title,
      description: errand.description,
      addressId: errand.addressId,
      location: (errand.location ?? {}) as Prisma.InputJsonValue,
      state: (errand.location as any)?.state ?? 'DEFAULT',
      budget: {
        amountMinorUnits: errand.budget.amountMinorUnits,
        currency: errand.budget.currency,
      },
      status: errand.status,
      sourceType: errand.sourceType,
      requiredTier: errand.requiredTier,
      marketId: errand.marketId,
      acceptedApplicationId: errand.acceptedApplicationId ?? null,
      workerPoolPercentageOverride:
        errand.workerPoolPercentageOverride ?? null,
      startedAt: errand.startedAt ?? null,
      completedAt: errand.completedAt ?? null,
      completedBy: errand.completedBy ?? null,
      cancelledAt: errand.cancelledAt ?? null,
      relistedFromErrandId: errand.relistedFromErrandId ?? null,
      createdAt: errand.createdAt,
      updatedAt: errand.updatedAt,
    };
  }

  toAssignmentDomain(record: PrismaErrandAssignment): ErrandAssignment {
    return new ErrandAssignment(
      ErrandAssignmentId.fromString(record.id),
      ErrandId.fromString(record.errandId),
      record.profileId,
      record.assignedByOrganizationId ?? undefined,
      record.splitPercentage ?? undefined,
      record.status as AssignmentStatus,
      record.confirmedAt ?? undefined,
      record.proofUrl ?? undefined,
      record.assignedAt,
    );
  }

  toAssignmentPersistence(
    assignment: ErrandAssignment,
  ): Prisma.ErrandAssignmentUncheckedCreateInput {
    return {
      id: assignment.id.value,
      errandId: assignment.errandId.value,
      profileId: assignment.providerPartyId,
      assignedByOrganizationId: assignment.assignedByOrganizationId ?? null,
      splitPercentage: assignment.splitPercentage ?? null,
      status: assignment.status,
      confirmedAt: assignment.confirmedAt ?? null,
      proofUrl: assignment.proofUrl ?? null,
      assignedAt: assignment.assignedAt,
    };
  }
}
