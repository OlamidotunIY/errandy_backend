import { Injectable } from '@nestjs/common';
import { ChatThread as PrismaChatThread, Prisma } from '@prisma/client';
import { ChatThread } from '@module/chat/domain';
import { ChatThreadId } from '@module/chat/domain';

@Injectable()
export class ChatThreadMapper {
  toDomain(record: PrismaChatThread): ChatThread {
    return new ChatThread(
      ChatThreadId.fromString(record.id),
      record.errandId,
      record.participantIds,
      record.createdAt,
      record.closedAt ?? undefined,
      record.firstResponseAt ?? undefined,
    );
  }

  toPersistence(thread: ChatThread): Prisma.ChatThreadUncheckedCreateInput {
    return {
      id: thread.id.value,
      errandId: thread.errandId,
      participantIds: thread.participantIds,
      createdAt: thread.createdAt,
      closedAt: thread.closedAt ?? null,
      firstResponseAt: thread.firstResponseAt ?? null,
    };
  }
}
