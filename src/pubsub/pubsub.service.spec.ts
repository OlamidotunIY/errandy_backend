import { Test, TestingModule } from '@nestjs/testing';
import { PubSubService } from './pubsub.service';

describe('PubSubService', () => {
  let service: PubSubService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PubSubService],
    }).compile();

    service = module.get<PubSubService>(PubSubService);
  });

  afterEach(() => {
    service.clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should publish and receive events', async () => {
    const testData = { message: 'Hello World' };
    const eventName = 'test-event';

    // Create async iterator
    const iterator = service.asyncIterator(eventName);

    // Publish event
    await service.publish(eventName, testData);

    // Should receive the event
    const result = await iterator.next();
    expect(result.done).toBe(false);
    expect(result.value).toEqual(testData);

    // Clean up
    if (iterator.return) {
      await iterator.return();
    }
  });

  it('should handle multiple subscribers', async () => {
    const testData = { message: 'Broadcast message' };
    const eventName = 'broadcast-event';
    const receivedData: any[] = [];

    // Create multiple iterators
    const iterator1 = service.asyncIterator(eventName);
    const iterator2 = service.asyncIterator(eventName);

    // Set up listeners
    const listener1 = iterator1.next().then(result => {
      receivedData.push({ subscriber: 1, data: result.value });
    });

    const listener2 = iterator2.next().then(result => {
      receivedData.push({ subscriber: 2, data: result.value });
    });

    // Publish event
    await service.publish(eventName, testData);

    // Wait for both listeners
    await Promise.all([listener1, listener2]);

    expect(receivedData).toHaveLength(2);
    expect(receivedData[0].data).toEqual(testData);
    expect(receivedData[1].data).toEqual(testData);

    // Clean up
    if (iterator1.return) {
      await iterator1.return();
    }
    if (iterator2.return) {
      await iterator2.return();
    }
  });

  it('should track subscriber count', async () => {
    const eventName = 'count-event';

    expect(service.getSubscriberCount(eventName)).toBe(0);

    const iterator1 = service.asyncIterator(eventName);
    const iterator2 = service.asyncIterator(eventName);

    // Note: subscribers are added when next() is called
    iterator1.next();
    iterator2.next();

    await service.publish(eventName, { test: true });

    expect(service.getSubscriberCount(eventName)).toBe(2);

    if (iterator1.return) {
      await iterator1.return();
    }
    expect(service.getSubscriberCount(eventName)).toBe(1);

    if (iterator2.return) {
      await iterator2.return();
    }
    expect(service.getSubscriberCount(eventName)).toBe(0);
  });

  it('should handle multiple events', async () => {
    const events = ['event1', 'event2'];
    const iterator = service.asyncIterator(events);

    const promise1 = iterator.next();
    await service.publish('event1', { from: 'event1' });
    const result1 = await promise1;

    const promise2 = iterator.next();
    await service.publish('event2', { from: 'event2' });
    const result2 = await promise2;

    expect(result1.value).toEqual({ from: 'event1' });
    expect(result2.value).toEqual({ from: 'event2' });

    if (iterator.return) {
      await iterator.return();
    }
  });

  it('should return active events', async () => {
    expect(service.getActiveEvents()).toEqual([]);

    const iterator1 = service.asyncIterator('event1');
    const iterator2 = service.asyncIterator('event2');

    iterator1.next();
    iterator2.next();

    await service.publish('event1', {});
    await service.publish('event2', {});

    const activeEvents = service.getActiveEvents();
    expect(activeEvents).toContain('event1');
    expect(activeEvents).toContain('event2');
    expect(activeEvents).toHaveLength(2);

    if (iterator1.return) {
      await iterator1.return();
    }
    if (iterator2.return) {
      await iterator2.return();
    }
  });
});