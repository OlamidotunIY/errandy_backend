export abstract class ValueObject<T extends object> {
  protected readonly props: Readonly<T>;

  protected constructor(props: T) {
    this.props = Object.freeze({ ...props });
  }

  public equals(other?: ValueObject<T>): boolean {
    if (!other) {
      return false;
    }

    if (this.constructor !== other.constructor) {
      return false;
    }

    return ValueObject.deepEqual(this.props, other.props);
  }

  public toJSON(): T {
    return { ...this.props };
  }

  private static deepEqual(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) {
      return true;
    }

    if (
      typeof a !== 'object' ||
      typeof b !== 'object' ||
      a === null ||
      b === null
    ) {
      return false;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
      return false;
    }

    return keysA.every((key) =>
      ValueObject.deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
    );
  }
}
