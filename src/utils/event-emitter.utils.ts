import { EventEmitter } from 'events';

// Singleton event emitter for use outside NestJS DI context
// This bridges the better-auth callbacks with NestJS event system
class GlobalEventEmitter extends EventEmitter {
  private static instance: GlobalEventEmitter;

  private constructor() {
    super();
  }

  static getInstance(): GlobalEventEmitter {
    if (!GlobalEventEmitter.instance) {
      GlobalEventEmitter.instance = new GlobalEventEmitter();
    }
    return GlobalEventEmitter.instance;
  }
}

export const globalEventEmitter = GlobalEventEmitter.getInstance();

// Event types
export interface UserCreatedEvent {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface UserUpdatedEvent {
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}
