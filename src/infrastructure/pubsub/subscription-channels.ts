/**
 * Centralised subscription channel definitions.
 *
 * Convention: channel names are static strings. Per-user or per-entity
 * filtering is handled via the GraphQL subscription `filter` option,
 * NOT by creating dynamic channel names.
 *
 * This keeps the Redis PubSub keyspace small and predictable.
 */
export const SubscriptionChannels = {
  /** Errand lifecycle updates (created, published, assigned, started, completed, archived) */
  ERRAND_UPDATED: 'errand.updated',

  /** Application status changes (submitted, accepted, rejected) */
  APPLICATION_UPDATED: 'application.updated',

  /** New chat messages in a thread */
  CHAT_MESSAGE_RECEIVED: 'chat.message.received',

  /** In-app notification delivered */
  NOTIFICATION_RECEIVED: 'notification.received',

  /** Escrow lifecycle updates (funded, released, completed) */
  ESCROW_UPDATED: 'escrow.updated',

  /** Payment transaction status changes */
  PAYMENT_UPDATED: 'payment.updated',
} as const;

export type SubscriptionChannel =
  (typeof SubscriptionChannels)[keyof typeof SubscriptionChannels];
