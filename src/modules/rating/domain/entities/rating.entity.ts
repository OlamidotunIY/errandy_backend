import { RatingSubmittedEvent } from '../events';

export interface RatingProps {
  id: string;
  errandId: string;
  raterId: string;
  rateeId: string;
  context: 'CLIENT_FACING' | 'INTERNAL';
  score: number;
  comment?: string | null;
  createdAt: Date;
}

export interface RatingReactionProps {
  id: string;
  ratingId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

export interface RatingReplyProps {
  id: string;
  ratingId: string;
  userId: string;
  content: string;
  createdAt: Date;
}

export class Rating {
  private _id: string;
  private _errandId: string;
  private _raterId: string;
  private _rateeId: string;
  private _context: 'CLIENT_FACING' | 'INTERNAL';
  private _score: number;
  private _comment?: string | null;
  private _createdAt: Date;
  private _domainEvents: any[] = [];

  constructor(props: RatingProps) {
    this._id = props.id;
    this._errandId = props.errandId;
    this._raterId = props.raterId;
    this._rateeId = props.rateeId;
    this._context = props.context || 'CLIENT_FACING';
    this._score = props.score;
    this._comment = props.comment ?? null;
    this._createdAt = props.createdAt || new Date();
  }

  static create(
    id: string,
    errandId: string,
    raterId: string,
    rateeId: string,
    score: number,
    comment?: string | null,
    context: 'CLIENT_FACING' | 'INTERNAL' = 'CLIENT_FACING',
    correlationId?: string,
  ): Rating {
    if (score < 1 || score > 5) {
      throw new Error('Rating score must be between 1 and 5');
    }

    const rating = new Rating({
      id,
      errandId,
      raterId,
      rateeId,
      context,
      score,
      comment: context === 'CLIENT_FACING' ? comment : null,
      createdAt: new Date(),
    });

    rating.addDomainEvent(
      new RatingSubmittedEvent({
        partyId: rateeId,
        rating: score,
        source: 'CLIENT_FACING',
        correlationId,
      }),
    );

    return rating;
  }

  get id(): string {
    return this._id;
  }

  get errandId(): string {
    return this._errandId;
  }

  get raterId(): string {
    return this._raterId;
  }

  get rateeId(): string {
    return this._rateeId;
  }

  get context(): 'CLIENT_FACING' | 'INTERNAL' {
    return this._context;
  }

  get score(): number {
    return this._score;
  }

  get comment(): string | null | undefined {
    return this._comment;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  addDomainEvent(event: any): void {
    this._domainEvents.push(event);
  }

  pullDomainEvents(): any[] {
    const events = this._domainEvents;
    this._domainEvents = [];
    return events;
  }

  toPrimitives(): RatingProps {
    return {
      id: this._id,
      errandId: this._errandId,
      raterId: this._raterId,
      rateeId: this._rateeId,
      context: this._context,
      score: this._score,
      comment: this._comment,
      createdAt: this._createdAt,
    };
  }
}
