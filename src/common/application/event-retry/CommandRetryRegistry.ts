import { Command } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';

interface CommandReconstructor<
  TCommand extends Command<unknown> = Command<unknown>,
> {
  reconstruct(payload: Record<string, unknown>): TCommand;
}

@Injectable()
class CommandRetryRegistry {
  private readonly registrations = new Map<string, CommandReconstructor>();

  /** Called once at module init time by each module that wants a command retryable through the shared queue. */
  register<TCommand extends Command<unknown>>(
    commandClassName: string,
    reconstructor: CommandReconstructor<TCommand>,
  ): void {
    this.registrations.set(commandClassName, reconstructor);
  }

  get(commandClassName: string): CommandReconstructor {
    const registration = this.registrations.get(commandClassName);
    if (!registration) {
      throw new Error(
        `No retry registration found for command "${commandClassName}" — did its module forget to register it?`,
      );
    }
    return registration;
  }
}

export { CommandRetryRegistry, CommandReconstructor };
