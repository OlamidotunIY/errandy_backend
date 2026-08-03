/**
 * Injection token for the shared PubSub instance.
 *
 * Used by subscription resolvers and domain event handlers to publish/subscribe
 * to real-time updates over GraphQL subscriptions.
 *
 * @example
 * ```ts
 * constructor(@Inject(PUB_SUB) private readonly pubSub: RedisPubSub) {}
 * ```
 */
export const PUB_SUB = Symbol('PUB_SUB');
