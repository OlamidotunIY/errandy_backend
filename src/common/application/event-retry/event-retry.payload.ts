export interface EventRetryPayload {
  commandClassName: string;
  commandPayload: Record<string, unknown>;
  correlationId: string;
  originatingEventId: string;
}
