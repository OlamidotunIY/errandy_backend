export const QUEUE_NAMES = {
  EVENT_RETRY: 'event-retry',
  ACCEPT_APPLICATION: 'accept-application',
  RELEASE_MATURED_ESCROWS: 'release-matured-escrows',
  AUTO_ACCEPT_ERRAND: 'auto-accept-errand',
  WALLET_RECONCILE_LEDGER: 'wallet_reconcile_ledger',
  PAYMENT_METHOD_VERIFICATION: 'payment-method-verification',
  WITHDRAWAL_REVERSAL: 'withdrawal-reversal',
  BANK_ACCOUNT_RESOLUTION: 'bank-account-resolution',
  PAYOUT_DISTRIBUTION: 'payout-distribution',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
