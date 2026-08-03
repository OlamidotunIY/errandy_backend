import { ValueObject } from '@src/common';

export interface GatewayReferenceProps {
  value: string;
}

export class GatewayReference extends ValueObject<GatewayReferenceProps> {
  private constructor(props: GatewayReferenceProps) {
    super(props);
  }

  static create(value: string): GatewayReference {
    if (!value || value.trim().length === 0) {
      throw new Error('Gateway reference cannot be empty');
    }
    return new GatewayReference({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
