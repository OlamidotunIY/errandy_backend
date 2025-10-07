# PubSub Service

A reusable, in-memory publish-subscribe service for real-time communication across the NestJS application.

## Features

- **Type-safe**: Full TypeScript support with proper interfaces
- **Real-time**: Event-driven communication for live updates
- **Memory-efficient**: Automatic cleanup and limited event queues
- **Error-resilient**: Proper error handling and subscriber management
- **Global**: Available across all modules as a global service
- **Testing-friendly**: Easy to mock and test

## Installation

The PubSub service is automatically available in your application as it's registered as a global module.

## Usage

### Basic Publishing and Subscribing

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { PubSubInterface } from 'src/pubsub';

@Injectable()
export class MyService {
  constructor(
    @Inject('PUB_SUB') private readonly pubSub: PubSubInterface,
  ) {}

  async publishEvent() {
    await this.pubSub.publish('user-created', {
      userId: '123',
      email: 'user@example.com',
    });
  }

  async subscribeToEvents() {
    const iterator = this.pubSub.asyncIterator('user-created');

    for await (const event of iterator) {
      console.log('Received event:', event);
      // Process the event
    }
  }
}
```

### GraphQL Subscriptions

```typescript
import { Resolver, Subscription } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { PubSubInterface } from 'src/pubsub';

@Resolver()
export class MyResolver {
  constructor(
    @Inject('PUB_SUB') private readonly pubSub: PubSubInterface,
  ) {}

  @Subscription()
  userCreated() {
    return this.pubSub.asyncIterator('user-created');
  }
}
```

### Multiple Event Subscription

```typescript
// Subscribe to multiple events
const iterator = this.pubSub.asyncIterator(['user-created', 'user-updated', 'user-deleted']);

for await (const event of iterator) {
  console.log('User event received:', event);
}
```

## API Reference

### Methods

#### `publish(event: string, data: any): Promise<void>`
Publishes data to all subscribers of the specified event.

- `event`: The event name
- `data`: The payload to send to subscribers

#### `asyncIterator(events: string | string[]): AsyncIterator<any>`
Creates an async iterator for the specified event(s).

- `events`: Single event name or array of event names to subscribe to
- Returns: AsyncIterator that yields event data

#### `getSubscriberCount(event: string): number`
Returns the current number of active subscribers for an event.

#### `getActiveEvents(): string[]`
Returns an array of event names that currently have active subscribers.

#### `clear(): void`
Clears all subscribers and event queues. Primarily used for testing.

## Event Management

### Memory Management
- Event queues are limited to the last 10 events per channel
- Automatic cleanup when subscribers disconnect
- No memory leaks from abandoned subscriptions

### Error Handling
- Failed subscriber callbacks don't affect other subscribers
- Proper cleanup on iterator termination
- Graceful handling of subscriber errors

## Example: Real-time Errand Updates

```typescript
// Publishing errand updates
await this.pubSub.publish('errandCreated', {
  errand: newErrand,
  type: 'CREATED',
  userId: user.id,
});

await this.pubSub.publish('errandUpdated', {
  errand: updatedErrand,
  type: 'UPDATED',
  userId: user.id,
});

// GraphQL subscription for real-time updates
@Subscription()
errandUpdates() {
  return this.pubSub.asyncIterator(['errandCreated', 'errandUpdated', 'errandDeleted']);
}
```

## Testing

The service includes comprehensive tests and utilities for testing:

```typescript
import { PubSubService } from 'src/pubsub';

// In your test
const pubSubService = new PubSubService();

// Test publishing and receiving
const iterator = pubSubService.asyncIterator('test-event');
await pubSubService.publish('test-event', { test: true });

const result = await iterator.next();
expect(result.value).toEqual({ test: true });

// Clean up
pubSubService.clear();
```

## Integration

The PubSub service is automatically integrated into:
- ✅ Errands module (for real-time errand updates)
- ✅ Available globally across all modules
- 🔄 Can be extended to other modules (Chat, Notifications, etc.)

## Performance Considerations

- In-memory storage: Suitable for single-instance deployments
- For multi-instance deployments, consider Redis-based PubSub
- Event queues are capped to prevent memory issues
- Automatic subscriber cleanup prevents resource leaks