class EscrowId extends EntityId {

    private constructor(value: string) {
        super(value);
    }

    static create(): EscrowId {
        return new EscrowId(crypto.randomUUID());
    }

    static fromString(value: string): EscrowId {
        return new EscrowId(value);
    }
}