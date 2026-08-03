abstract class EntityId {
  protected constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('id value is required');
    }
  }

  equals(other: EntityId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

export { EntityId };
