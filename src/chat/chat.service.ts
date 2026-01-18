import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { SendMessageInput } from './dto/send-message.input';
import { PubSubInterface } from 'src/pubsub';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('PUB_SUB') private readonly pubSub: PubSubInterface,
  ) {}

  async getUserChats(userId: string) {
    return this.prisma.chatRoom.findMany({
      where: {
        participants: {
          has: userId,
        },
      },
      include: {
        messages: {
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  async getOrCreateChat(participantIds: string[]) {
    const participants = this.normalizeParticipants(participantIds);
    if (participants.length === 0) {
      throw new BadRequestException('At least one participant is required');
    }

    const roomKey = participants.join(':');

    return this.prisma.chatRoom.upsert({
      where: {
        roomKey,
      },
      create: {
        participants,
        roomKey,
      },
      update: {},
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }

  async sendMessage(dto: SendMessageInput) {
    const room = await this.prisma.chatRoom.findUnique({
      where: {
        id: dto.roomId,
      },
    });

    if (!room) {
      throw new BadRequestException('Room not found');
    }

    if (!room.participants.includes(dto.senderId)) {
      throw new BadRequestException('User is not a participant in this room');
    }

    const message = await this.prisma.message.create({
      data: {
        roomId: dto.roomId,
        content: dto.content,
        senderId: dto.senderId,
        type: dto.type,
        contentUrl: dto.contentUrl,
      },
    });

    for (const participantId of room.participants) {
      this.pubSub.publish(`messageSent:${participantId}`, {
        messageSent: {
          message,
          type: 'MESSAGE_SENT',
          userId: participantId,
        },
      });
    }

    return message;
  }

  

  private normalizeParticipants(participantIds: string[]) {
    return Array.from(new Set(participantIds)).sort();
  }
}
