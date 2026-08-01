import { AggregateRoot } from '@src/common';
import { ChatThreadId } from '../value-objects';
import {
  ChatThreadOpenedEvent,
  ChatThreadClosedEvent,
  ProviderRespondedFirstTimeEvent,
} from '../events';
import { ChatThreadClosedError } from '../errors';

export class ChatThread extends AggregateRoot<ChatThreadId> {
  constructor(
    public readonly id: ChatThreadId,
    private readonly _errandId: string,
    private readonly _participantIds: string[],
    public readonly createdAt: Date,
    private _closedAt: Date | undefined,
    private _firstResponseAt: Date | undefined,
  ) {
    super(id);
  }

  static open(
    errandId: string,
    participantIds: string[],
    correlationId?: string,
  ): ChatThread {
    const thread = new ChatThread(
      ChatThreadId.create(),
      errandId,
      participantIds,
      new Date(),
      undefined,
      undefined,
    );

    thread.addDomainEvent(
      new ChatThreadOpenedEvent(thread.id, correlationId, {
        threadId: thread.id.value,
        errandId,
      }),
    );

    return thread;
  }

  get errandId(): string {
    return this._errandId;
  }

  get participantIds(): string[] {
    return this._participantIds;
  }

  get closedAt(): Date | undefined {
    return this._closedAt;
  }

  get firstResponseAt(): Date | undefined {
    return this._firstResponseAt;
  }

  isOpen(): boolean {
    return !this._closedAt;
  }

  close(correlationId?: string): void {
    if (this._closedAt) {
      return;
    }

    this._closedAt = new Date();

    this.addDomainEvent(
      new ChatThreadClosedEvent(this.id, correlationId, {
        threadId: this.id.value,
      }),
    );
  }

  recordFirstResponse(providerId: string, correlationId?: string): void {
    if (!this.isOpen()) {
      throw new ChatThreadClosedError(this.id.value);
    }

    if (this._firstResponseAt) {
      return;
    }

    this._firstResponseAt = new Date();
    const responseTimeSeconds = Math.max(
      0,
      Math.floor(
        (this._firstResponseAt.getTime() - this.createdAt.getTime()) / 1000,
      ),
    );

    this.addDomainEvent(
      new ProviderRespondedFirstTimeEvent(this.id, correlationId, {
        threadId: this.id.value,
        providerId,
        responseTimeSeconds,
      }),
    );
  }
}
