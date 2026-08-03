import { Injectable } from '@nestjs/common';
import {
  ClientRole,
  OrgMemberRole,
  Organization,
  OrganizationMember,
  OrganizationMemberId,
  Party,
  PartyId,
  PartyKind,
  Person,
  ProviderRole,
  ProviderTier,
} from '@module/party';
import { Prisma, Party as PrismaParty } from '@prisma/client';
import { UserId } from '@module/user';

type PrismaPartyWithRelations = Prisma.PartyGetPayload<{
  include: {
    person: true;
    organization: {
      include: {
        members: true;
      };
    };
    providerRole: true;
    clientRole: true;
  };
}>;

@Injectable()
export class PartyMapper {
  toDomain(prismaParty: PrismaPartyWithRelations): Party {
    const person = prismaParty.person
      ? new Person(
          PartyId.fromString(prismaParty.id),
          UserId.fromString(prismaParty.person.userId),
        )
      : null;

    const organization = prismaParty.organization
      ? new Organization(
          PartyId.fromString(prismaParty.organization.id),
          prismaParty.organization.name,
          prismaParty.organization.businessRegistrationNumber,
          UserId.fromString(prismaParty.organization.ownerId),
          prismaParty.organization.createdAt,
          prismaParty.updatedAt,
          prismaParty.organization.workerPoolPercentage,
          prismaParty.organization.members.map(
            (member) =>
              new OrganizationMember(
                OrganizationMemberId.fromString(member.id),
                PartyId.fromString(member.organizationId),
                UserId.fromString(member.userId),
                member.role as OrgMemberRole,
                member.active,
              ),
          ),
        )
      : null;

    const providerRole = prismaParty.providerRole
      ? new ProviderRole(
          PartyId.fromString(prismaParty.providerRole.id),
          prismaParty.providerRole.tier as ProviderTier,
          prismaParty.providerRole.skills,
          prismaParty.providerRole.verificationStatus,
          prismaParty.providerRole.trustedByCount,
          prismaParty.providerRole.completedErrandsCount,
          prismaParty.providerRole.disputedErrandsCount,
          prismaParty.providerRole.isActive,
          prismaParty.providerRole.createdAt,
          prismaParty.providerRole.updatedAt,
          prismaParty.providerRole.bio ?? undefined,
          prismaParty.providerRole.avgResponseTimeSeconds ?? undefined,
          prismaParty.providerRole.avgRatingCached ?? undefined,
        )
      : null;

    const clientRole = prismaParty.clientRole
      ? new ClientRole(
          PartyId.fromString(prismaParty.clientRole.id),
          prismaParty.clientRole.defaultPaymentMethodId ?? undefined,
          prismaParty.clientRole.isActive,
          prismaParty.clientRole.createdAt,
          prismaParty.clientRole.updatedAt,
        )
      : null;

    return new Party(
      PartyId.fromString(prismaParty.id),
      prismaParty.kind as PartyKind,
      prismaParty.marketId,
      prismaParty.isActive,
      prismaParty.createdAt,
      prismaParty.updatedAt,
      person,
      organization,
      providerRole,
      clientRole,
    );
  }

  toPartyPersistence(party: Party): Prisma.PartyCreateInput {
    return {
      id: party.id.value,
      kind: party.kind,
      marketId: party.marketId,
      isActive: party.isActive,
      createdAt: party.createdAt,
      updatedAt: party.updatedAt,
    };
  }

  toPartyUpdatePersistence(party: Party): Prisma.PartyUpdateInput {
    return {
      kind: party.kind,
      marketId: party.marketId,
      isActive: party.isActive,
      updatedAt: party.updatedAt,
    };
  }

  toPersonCreatePersistence(party: Party): Prisma.PersonCreateInput {
    return {
      userId: party.person!.userId.value,
      party: { connect: { id: party.id.value } },
    };
  }

  toOrganizationCreatePersistence(
    party: Party,
  ): Prisma.OrganizationCreateInput {
    return {
      name: party.organization!.name,
      businessRegistrationNumber:
        party.organization!.businessRegistrationNumber,
      ownerId: party.organization!.ownerId.value,
      workerPoolPercentage: party.organization!.workerPoolPercentage,
      createdAt: party.organization!.createdAt,
      party: { connect: { id: party.id.value } },
    };
  }

  toOrganizationUpdatePersistence(
    party: Party,
  ): Prisma.OrganizationUpdateInput {
    return {
      name: party.organization!.name,
      businessRegistrationNumber:
        party.organization!.businessRegistrationNumber,
      ownerId: party.organization!.ownerId.value,
      workerPoolPercentage: party.organization!.workerPoolPercentage,
    };
  }

  toProviderRoleCreatePersistence(
    party: Party,
  ): Prisma.ProviderRoleCreateInput {
    const providerRole = party.providerRole!;
    return {
      tier: providerRole.tier,
      bio: providerRole.bio,
      skills: providerRole.skills,
      verificationStatus: providerRole.verificationStatus,
      trustedByCount: providerRole.trustedByCount,
      completedErrandsCount: providerRole.completedErrandsCount,
      disputedErrandsCount: providerRole.disputedErrandsCount,
      avgResponseTimeSeconds: providerRole.avgResponseTimeSeconds,
      avgRatingCached: providerRole.avgRatingCached,
      isActive: providerRole.isActive,
      createdAt: providerRole.createdAt,
      updatedAt: providerRole.updatedAt,
      party: { connect: { id: party.id.value } },
    };
  }

  toProviderRoleUpdatePersistence(
    party: Party,
  ): Prisma.ProviderRoleUpdateInput {
    const providerRole = party.providerRole!;
    return {
      tier: providerRole.tier,
      bio: providerRole.bio,
      skills: providerRole.skills,
      verificationStatus: providerRole.verificationStatus,
      trustedByCount: providerRole.trustedByCount,
      completedErrandsCount: providerRole.completedErrandsCount,
      disputedErrandsCount: providerRole.disputedErrandsCount,
      avgResponseTimeSeconds: providerRole.avgResponseTimeSeconds,
      avgRatingCached: providerRole.avgRatingCached,
      isActive: providerRole.isActive,
      updatedAt: providerRole.updatedAt,
    };
  }

  toClientRoleCreatePersistence(party: Party): Prisma.ClientRoleCreateInput {
    const clientRole = party.clientRole!;
    return {
      defaultPaymentMethodId: clientRole.defaultPaymentMethodId,
      isActive: clientRole.isActive,
      createdAt: clientRole.createdAt,
      updatedAt: clientRole.updatedAt,
      party: { connect: { id: party.id.value } },
    };
  }

  toClientRoleUpdatePersistence(party: Party): Prisma.ClientRoleUpdateInput {
    const clientRole = party.clientRole!;
    return {
      defaultPaymentMethodId: clientRole.defaultPaymentMethodId,
      isActive: clientRole.isActive,
      updatedAt: clientRole.updatedAt,
    };
  }

  toOrganizationMemberCreateMany(
    organization: Organization,
  ): Prisma.OrganizationMemberCreateManyInput[] {
    return organization.members.map((member) => ({
      id: member.id.value,
      organizationId: organization.id.value,
      userId: member.userId.value,
      role: member.role,
      active: member.active,
    }));
  }

  toOrganizationMembers(
    rows: Array<{
      id: string;
      organizationId: string;
      userId: string;
      role: string;
      active: boolean;
    }>,
  ): OrganizationMember[] {
    return rows.map(
      (member) =>
        new OrganizationMember(
          OrganizationMemberId.fromString(member.id),
          PartyId.fromString(member.organizationId),
          UserId.fromString(member.userId),
          member.role as OrgMemberRole,
          member.active,
        ),
    );
  }

  toFlatParty(prismaParty: PrismaParty): Party {
    return new Party(
      PartyId.fromString(prismaParty.id),
      prismaParty.kind as PartyKind,
      prismaParty.marketId,
      prismaParty.isActive,
      prismaParty.createdAt,
      prismaParty.updatedAt,
    );
  }
}
