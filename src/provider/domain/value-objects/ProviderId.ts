class ProviderId extends EntityId {
  constructor(value: string) {
    super(value);
  }

  static create(): ProviderId {
    return new ProviderId(crypto.randomUUID());
  }

  static fromString(value: string): ProviderId {
    return new ProviderId(value);
  }
}

export { ProviderId };
