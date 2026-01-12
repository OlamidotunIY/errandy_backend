import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AddToCircleInput } from './dto/add-to-circle.input';
import { ShareCircleInput } from './dto/share-circle.input';
import { CircleSource } from './entities/circle-source.enum';
import { TrustedCircleMemberStatus } from './entities/trusted-circle-member-status.enum';

@Injectable()
export class TrustedCircleService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrustedCircle(userId: string) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) return null;

    return this.prisma.trustedCircle.findFirst({
      where: { clientId: client.id },
      include: {
        members: {
          where: { status: TrustedCircleMemberStatus.ACTIVE },
          include: {
            provider: {
              include: { user: true },
            },
          },
        },
      },
    });
  }

  async getPendingMembers(userId: string) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) return [];

    const circle = await this.prisma.trustedCircle.findFirst({
      where: { clientId: client.id },
    });

    if (!circle) return [];

    return this.prisma.trustedCircleMember.findMany({
      where: {
        trustedCircleId: circle.id,
        status: TrustedCircleMemberStatus.PENDING,
      },
      include: {
        provider: {
          include: { user: true },
        },
      },
    });
  }

  async addToCircle(userId: string, input: AddToCircleInput) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) throw new NotFoundException('Client profile not found');

    // Find or create trusted circle
    let circle = await this.prisma.trustedCircle.findFirst({
      where: { clientId: client.id },
    });

    if (!circle) {
      circle = await this.prisma.trustedCircle.create({
        data: {
          clientId: client.id,
          name: input.circleName || 'My Trusted Circle',
        },
      });
    }

    // Check if provider exists
    // We could verify provider existence here, or let FK constraint handle it
    // but better to check to give good error
    const provider = await this.prisma.provider.findUnique({
      where: { id: input.providerId },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    // Check if member exists
    const existingMember = await this.prisma.trustedCircleMember.findUnique({
      where: {
        trustedCircleId_providerId: {
          trustedCircleId: circle.id,
          providerId: input.providerId,
        },
      },
    });

    if (existingMember) return circle; // Already added

    await this.prisma.trustedCircleMember.create({
      data: {
        trustedCircleId: circle.id,
        providerId: input.providerId,
        source: CircleSource.MANUAL_ADD,
      },
    });

    return this.getTrustedCircle(userId);
  }

  async removeFromCircle(userId: string, providerId: string) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) throw new NotFoundException('Client profile not found');

    const circle = await this.prisma.trustedCircle.findFirst({
      where: { clientId: client.id },
    });

    if (!circle) throw new NotFoundException('Trusted circle not found');

    await this.prisma.trustedCircleMember.deleteMany({
      where: {
        trustedCircleId: circle.id,
        providerId: providerId,
      },
    });

    return this.getTrustedCircle(userId);
  }

  async shareCircle(userId: string, input: ShareCircleInput) {
    if (!input.recipientEmail && !input.recipientUserId) {
      throw new BadRequestException('Recipient email or User ID required');
    }

    // Get Sender
    const senderClient = await this.prisma.client.findUnique({
      where: { userId },
    });
    if (!senderClient)
      throw new NotFoundException('Sender client profile not found');

    // Get Sender's Circle
    const senderCircle = await this.prisma.trustedCircle.findFirst({
      where: { clientId: senderClient.id },
      include: { members: true },
    });

    if (!senderCircle || senderCircle.members.length === 0) {
      throw new NotFoundException(
        "You don't have any trusted providers to share.",
      );
    }

    // Get Recipient
    let recipientUserId = input.recipientUserId;
    if (!recipientUserId && input.recipientEmail) {
      const recipientUser = await this.prisma.user.findUnique({
        where: { email: input.recipientEmail },
      });
      if (!recipientUser)
        throw new NotFoundException('Recipient user not found');
      recipientUserId = recipientUser.id;
    }

    if (!recipientUserId)
      throw new BadRequestException('Could not identify recipient');

    const recipientClient = await this.prisma.client.findUnique({
      where: { userId: recipientUserId },
    });
    if (!recipientClient)
      throw new NotFoundException('Recipient client profile not found');

    // Get/Create Recipient Circle
    let recipientCircle = await this.prisma.trustedCircle.findFirst({
      where: { clientId: recipientClient.id },
    });

    if (!recipientCircle) {
      recipientCircle = await this.prisma.trustedCircle.create({
        data: {
          clientId: recipientClient.id,
          name: 'My Trusted Circle',
        },
      });
    }

    // Add members to recipient circle
    const newMembersData = senderCircle.members.map((m) => ({
      trustedCircleId: recipientCircle!.id,
      providerId: m.providerId,
      source: CircleSource.INVITED,
    }));

    // Use loop to ignore duplicates (skip duplicates)
    // or deleteMany then createMany? No, we don't want to delete existing sources.
    // Ideally upsert or ignore conflicts. createMany with skipDuplicates is supported in some prisma versions/drivers.
    // MongoDB supports createMany but skipDuplicates might vary.
    // Safe approach: loop and upsert or create-catch-error.

    for (const member of newMembersData) {
      try {
        // Check existence first to avoid error spam
        const exists = await this.prisma.trustedCircleMember.findUnique({
          where: {
            trustedCircleId_providerId: {
              trustedCircleId: member.trustedCircleId,
              providerId: member.providerId,
            },
          },
        });

        if (!exists) {
          await this.prisma.trustedCircleMember.create({
            data: {
              ...member,
              status: TrustedCircleMemberStatus.PENDING,
            },
          });
        }
      } catch (e) {
        // ignore
      }
    }

    return true;
  }

  async acceptSharedProvider(userId: string, providerId: string) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) throw new NotFoundException('Client profile not found');

    const circle = await this.prisma.trustedCircle.findFirst({
      where: { clientId: client.id },
    });
    if (!circle) throw new NotFoundException('Trusted circle not found');

    const member = await this.prisma.trustedCircleMember.findUnique({
      where: {
        trustedCircleId_providerId: {
          trustedCircleId: circle.id,
          providerId: providerId,
        },
      },
    });

    if (!member) throw new NotFoundException('Provider not in trusted circle');
    if (member.status === TrustedCircleMemberStatus.ACTIVE) return circle;

    await this.prisma.trustedCircleMember.update({
      where: { id: member.id },
      data: { status: TrustedCircleMemberStatus.ACTIVE },
    });

    return this.getTrustedCircle(userId);
  }

  async rejectSharedProvider(userId: string, providerId: string) {
    const client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) throw new NotFoundException('Client profile not found');

    const circle = await this.prisma.trustedCircle.findFirst({
      where: { clientId: client.id },
    });
    if (!circle) throw new NotFoundException('Trusted circle not found');

    try {
      await this.prisma.trustedCircleMember.delete({
        where: {
          trustedCircleId_providerId: {
            trustedCircleId: circle.id,
            providerId: providerId,
          },
        },
      });
    } catch (e) {
      // Ignore if already deleted or not found
    }

    return this.getTrustedCircle(userId);
  }
}
