abstract class EntityId {
  protected constructor(public readonly value: string) {}

  equals(other: EntityId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
