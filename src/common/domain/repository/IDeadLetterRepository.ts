export interface DeadLetterEntry {
  queueName: string;
  payload: Record<string, unknown>;
  failureReason: string;
  attemptsMade: number;
  isPermanent: boolean;
}

export abstract class IDeadLetterRepository {
  abstract record(entry: DeadLetterEntry): Promise<void>;
}
