import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class PresenceService {
  constructor(private readonly redis: Redis) {}

  private connectionsKey(userId: string) {
    return `presence:user:${userId}:connections`;
  }

  private lastSeenKey(userId: string) {
    return `presence:user:${userId}:lastSeenAt`;
  }

  async addConnection(userId: string, connectionId: string) {
    const key = this.connectionsKey(userId);

    await this.redis.sadd(key, connectionId);

    // safety TTL so stale connections don’t keep someone "online" forever
    await this.redis.expire(key, 60 * 60);

    return this.isOnline(userId);
  }

  async removeConnection(userId: string, connectionId: string) {
    const key = this.connectionsKey(userId);

    await this.redis.srem(key, connectionId);

    return this.isOnline(userId);
  }

  async isOnline(userId: string) {
    const count = await this.redis.scard(this.connectionsKey(userId));
    return count > 0;
  }

  async setLastSeen(userId: string) {
    await this.redis.set(
      this.lastSeenKey(userId),
      new Date().toISOString(),
      'EX',
      60 * 60 * 24 * 30,
    );
  }

  async getLastSeen(userId: string) {
    return this.redis.get(this.lastSeenKey(userId));
  }
}
