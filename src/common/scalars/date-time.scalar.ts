import { Scalar, CustomScalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';

@Scalar('DateTime')
export class DateTimeScalar implements CustomScalar<string | null, Date | null> {
  description =
    'A date-time string at UTC, such as 2019-12-03T09:54:33Z, compliant with the date-time format.';

  parseValue(value: unknown): Date | null {
    return this.parseDate(value);
  }

  serialize(value: unknown): string | null {
    const date = this.parseDate(value);
    return date ? date.toISOString() : null;
  }

  parseLiteral(
    ast: ValueNode,
    _variables?: Record<string, unknown>,
  ): Date | null {
    if (ast.kind !== Kind.STRING) {
      return null;
    }
    return this.parseDate(ast.value);
  }

  private parseDate(value: unknown): Date | null {
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }
}
