import { registerEnumType } from '@nestjs/graphql';

export enum ProviderTier {
  COMMUNITY = 'COMMUNITY',
  VERIFIED = 'VERIFIED',
  CERTIFIED = 'CERTIFIED',
  COMPANY_PARTNER = 'COMPANY_PARTNER',
}

registerEnumType(ProviderTier, {
  name: 'ProviderTier',
});
