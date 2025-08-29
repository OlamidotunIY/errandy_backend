import { registerEnumType } from '@nestjs/graphql';

export enum PricingType {
  FIXED = 'FIXED',
  HOURLY = 'HOURLY',
}

registerEnumType(PricingType, { name: 'PricingType' });