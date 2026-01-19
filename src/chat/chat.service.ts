import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma.service';
import { SendMessageInput } from './dto/send-message.input';
import { PubSubInterface } from 'src/pubsub';
import { FirebaseStorageService } from 'src/firebase/firebase-storage.service';
import { FileUpload } from 'graphql-upload-ts';
import { MessageType } from './entities/message-type.enum';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('PUB_SUB') private readonly pubSub: PubSubInterface,
    private readonly firebaseStorageService: FirebaseStorageService,
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

    let contentUrl = dto.contentUrl;

    if (dto.file) {
      const upload = await dto.file;
      this.validateMimeTypeForMessageType(dto.type, upload.mimetype);
      contentUrl = await this.uploadChatAttachment(dto.roomId, upload);
    }

    if (dto.type === MessageType.TEXT && !dto.content) {
      throw new BadRequestException('Content is required for text messages');
    }

    if (dto.type !== MessageType.TEXT && !contentUrl) {
      throw new BadRequestException(
        'Attachment is required for non-text messages',
      );
    }

    const message = await this.prisma.message.create({
      data: {
        roomId: dto.roomId,
        content: dto.content,
        senderId: dto.senderId,
        type: dto.type,
        contentUrl,
        sent: true,
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

  async markMessageAsDelivered(messageId: string) {
    const message = await this.prisma.message.update({
      where: {
        id: messageId,
      },
      data: {
        delivered: true,
      },
      include: {
        room: true,
      },
    });

    for (const participantId of message.room.participants) {
      this.pubSub.publish(`messageDelivered:${participantId}`, {
        messageDelivered: {
          message,
          type: 'MESSAGE_DELIVERED',
          userId: participantId,
        },
      });
    }

    return message;
  }

  async markMessageAsSeen(messageId: string) {
    const message = await this.prisma.message.update({
      where: {
        id: messageId,
      },
      data: {
        seen: true,
      },
      include: {
        room: true,
      },
    });

    for (const participantId of message.room.participants) {
      this.pubSub.publish(`messageSeen:${participantId}`, {
        messageSeen: {
          message,
          type: 'MESSAGE_SEEN',
          userId: participantId,
        },
      });
    }

    return message;
  }

  private normalizeParticipants(participantIds: string[]) {
    return Array.from(new Set(participantIds)).sort();
  }

  private async uploadChatAttachment(roomId: string, upload: FileUpload) {
    const safeName = this.sanitizeFilename(upload.filename);
    const destination = `chats/${roomId}/${Date.now()}_${randomUUID()}_${safeName}`;

    const result = await this.firebaseStorageService.uploadStream({
      stream: upload.createReadStream(),
      destination,
      contentType: upload.mimetype,
      makePublic: true,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        originalName: upload.filename,
      },
    });

    return result.url;
  }

  private validateMimeTypeForMessageType(type: MessageType, mimeType: string) {
    if (type === MessageType.IMAGE && !mimeType.startsWith('image/')) {
      throw new BadRequestException('Image messages must be image files');
    }

    if (type === MessageType.VIDEO && !mimeType.startsWith('video/')) {
      throw new BadRequestException('Video messages must be video files');
    }

    if (type === MessageType.VOICE && !mimeType.startsWith('audio/')) {
      throw new BadRequestException('Voice notes must be audio files');
    }
  }

  private sanitizeFilename(filename: string) {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }
}
