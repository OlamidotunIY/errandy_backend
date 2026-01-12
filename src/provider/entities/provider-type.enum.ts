import { registerEnumType } from '@nestjs/graphql';

export enum ProviderType {
  PROFESSIONAL = 'PROFESSIONAL',
  GENERAL = 'GENERAL',
  ARTISAN = 'ARTISAN',
}

registerEnumType(ProviderType, {
  name: 'ProviderType',
});
