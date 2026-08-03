import { Injectable } from '@nestjs/common';
import {
  IPartyRepository,
  OrganizationMember,
  Party,
  PartyInvariantError,
} from '@module/party';
import { PrismaService } from '@src/prisma/prisma.service';
import { PartyMapper } from '../mappers';

@Injectable()
export class PrismaPartyRepository implements IPartyRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: PartyMapper,
  ) {}

  async save(party: Party): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.party.findUnique({
        where: { id: party.id.value },
      });

      if (existing) {
        await tx.party.update({
          where: { id: party.id.value },
          data: this.mapper.toPartyUpdatePersistence(party),
        });
      } else {
        await tx.party.create({
          data: this.mapper.toPartyPersistence(party),
        });
      }

      if (party.person) {
        await tx.person.upsert({
          where: { id: party.id.value },
          update: {
            userId: party.person.userId.value,
          },
          create: this.mapper.toPersonCreatePersistence(party),
        });
      }

      if (party.organization) {
        await tx.organization.upsert({
          where: { id: party.id.value },
          update: this.mapper.toOrganizationUpdatePersistence(party),
          create: this.mapper.toOrganizationCreatePersistence(party),
        });

        const members = this.mapper.toOrganizationMemberCreateMany(
          party.organization,
        );
        await tx.organizationMember.deleteMany({
          where: { organizationPartyId: party.organization.id.value },
        });

        if (members.length > 0) {
          await tx.organizationMember.createMany({
            data: members,
          });
        }
      }

      if (party.providerRole) {
        await tx.providerRole.upsert({
          where: { id: party.id.value },
          update: this.mapper.toProviderRoleUpdatePersistence(party),
          create: this.mapper.toProviderRoleCreatePersistence(party),
        });
      }

      if (party.clientRole) {
        await tx.clientRole.upsert({
          where: { id: party.id.value },
          update: this.mapper.toClientRoleUpdatePersistence(party),
          create: this.mapper.toClientRoleCreatePersistence(party),
        });
      }
    });
  }

  async findById(id: string): Promise<Party | null> {
    const row = await this.prisma.party.findUnique({
      where: { id },
      include: {
        person: true,
        organization: {
          include: {
            members: true,
          },
        },
        providerRole: true,
        clientRole: true,
      },
    });

    return row ? this.mapper.toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<Party | null> {
    const row = await this.prisma.party.findFirst({
      where: {
        person: {
          is: {
            userId,
          },
        },
      },
      include: {
        person: true,
        organization: {
          include: {
            members: true,
          },
        },
        providerRole: true,
        clientRole: true,
      },
    });

    return row ? this.mapper.toDomain(row) : null;
  }

  async findByBusinessRegistrationNumber(
    businessRegistrationNumber: string,
  ): Promise<Party | null> {
    const row = await this.prisma.party.findFirst({
      where: {
        organization: {
          is: {
            businessRegistrationNumber,
          },
        },
      },
      include: {
        person: true,
        organization: {
          include: {
            members: true,
          },
        },
        providerRole: true,
        clientRole: true,
      },
    });

    return row ? this.mapper.toDomain(row) : null;
  }

  async findByOwnerId(userId: string): Promise<Party[]> {
    const rows = await this.prisma.party.findMany({
      where: {
        organization: {
          is: {
            ownerId: userId,
          },
        },
      },
      include: {
        person: true,
        organization: {
          include: {
            members: true,
          },
        },
        providerRole: true,
        clientRole: true,
      },
    });

    return rows.map((row) => this.mapper.toDomain(row));
  }

  async findOrganizationMembers(
    organizationPartyId: string,
  ): Promise<OrganizationMember[]> {
    const row = await this.prisma.party.findUnique({
      where: { id: organizationPartyId },
      include: {
        organization: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!row?.organization) {
      throw new PartyInvariantError(
        `Organization not found for party ${organizationPartyId}`,
      );
    }

    return this.mapper.toOrganizationMembers(row.organization.members);
  }

  async searchProvidersBySkill(
    skill: string,
    limit: number = 20,
  ): Promise<Party[]> {
    const rows = await this.prisma.party.findMany({
      where: {
        providerRole: {
          is: {
            isActive: true,
            skills: {
              has: skill,
            },
          },
        },
      },
      include: {
        person: true,
        organization: {
          include: {
            members: true,
          },
        },
        providerRole: true,
        clientRole: true,
      },
      take: limit,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return rows.map((row) => this.mapper.toDomain(row));
  }
}
