export class AuthUserRegisteredEvent {
  constructor(
    public readonly payload: {
      userId: string;
      email?: string;
      phoneNumber: string;
      marketId: string;
      role?: 'client' | 'provider';
      correlationId?: string;
    },
  ) {}
}
