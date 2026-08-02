export class AuthUserRegisteredEvent {
  constructor(
    public readonly payload: {
      userId: string;
      email?: string;
      phoneNumber: string;
      marketId: string;
      correlationId?: string;
    },
  ) {}
}
