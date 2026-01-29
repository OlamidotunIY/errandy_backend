import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyOrganization(userId: string) {
    // Find organization where user is a member
    const member = await this.prisma.orgMember.findFirst({
      where: {
        userId,
        active: true,
      },
      include: {
        org: {
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (member) {
      return member.org;
    }

    // Fallback: check if user owns an organization directly (if not using member table for owners)
    return this.prisma.organization.findFirst({
      where: {
        ownerId: userId,
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });
  }
}
