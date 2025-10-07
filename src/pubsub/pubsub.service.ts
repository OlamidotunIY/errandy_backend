import { Injectable } from '@nestjs/common';

export interface PubSubInterface {
  publish(event: string, data: any): Promise<void>;
  asyncIterator(events: string | string[]): AsyncIterator<any>;
}

@Injectable()
export class PubSubService implements PubSubInterface {
  private subscribers = new Map<string, Array<(data: any) => void>>();
  private eventQueues = new Map<string, any[]>();

  async publish(event: string, data: any): Promise<void> {
    const eventSubscribers = this.subscribers.get(event) || [];

    // Notify all current subscribers
    eventSubscribers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.warn(`Error in PubSub subscriber for event ${event}:`, error);
      }
    });

    // Store in queue for future subscribers
    const queue = this.eventQueues.get(event) || [];
    queue.push(data);

    // Keep only last 10 events per channel to prevent memory leaks
    if (queue.length > 10) {
      queue.shift();
    }

    this.eventQueues.set(event, queue);
  }

  asyncIterator(events: string | string[]): AsyncIterator<any> {
    const eventArray = Array.isArray(events) ? events : [events];
    let isActive = true;
    const pendingPromises: Array<{
      resolve: (value: any) => void;
      reject: (error: any) => void;
    }> = [];

    // Subscribe to events
    const unsubscribeFunctions: Array<() => void> = [];

    eventArray.forEach(event => {
      const callback = (data: any) => {
        if (!isActive) return;

        const pending = pendingPromises.shift();
        if (pending) {
          pending.resolve({ value: data, done: false });
        }
      };

      const subscribers = this.subscribers.get(event) || [];
      subscribers.push(callback);
      this.subscribers.set(event, subscribers);

      // Create unsubscribe function
      const unsubscribe = () => {
        const currentSubscribers = this.subscribers.get(event) || [];
        const index = currentSubscribers.indexOf(callback);
        if (index !== -1) {
          currentSubscribers.splice(index, 1);
          this.subscribers.set(event, currentSubscribers);
        }
      };

      unsubscribeFunctions.push(unsubscribe);
    });

    return {
      next(): Promise<IteratorResult<any>> {
        if (!isActive) {
          return Promise.resolve({ value: undefined, done: true });
        }

        return new Promise((resolve, reject) => {
          pendingPromises.push({ resolve, reject });
        });
      },

      return(): Promise<IteratorResult<any>> {
        isActive = false;

        // Unsubscribe from all events
        unsubscribeFunctions.forEach(unsubscribe => unsubscribe());

        // Reject all pending promises
        pendingPromises.forEach(({ reject }) => {
          reject(new Error('AsyncIterator was closed'));
        });
        pendingPromises.length = 0;

        return Promise.resolve({ value: undefined, done: true });
      },

      throw(error: any): Promise<IteratorResult<any>> {
        isActive = false;

        // Unsubscribe from all events
        unsubscribeFunctions.forEach(unsubscribe => unsubscribe());

        // Reject all pending promises
        pendingPromises.forEach(({ reject }) => {
          reject(error);
        });
        pendingPromises.length = 0;

        return Promise.reject(error);
      },
    };
  }

  /**
   * Get current subscriber count for an event
   */
  getSubscriberCount(event: string): number {
    return (this.subscribers.get(event) || []).length;
  }

  /**
   * Get all active events
   */
  getActiveEvents(): string[] {
    return Array.from(this.subscribers.keys()).filter(
      event => (this.subscribers.get(event) || []).length > 0
    );
  }

  /**
   * Clear all subscribers and queues (useful for testing)
   */
  clear(): void {
    this.subscribers.clear();
    this.eventQueues.clear();
  }
}