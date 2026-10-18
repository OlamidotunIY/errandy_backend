export abstract class ILogger {
  abstract info(message: string, context?: Record<string, unknown>): void;
  abstract error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void;
  abstract warn(message: string, context?: Record<string, unknown>): void;
}
