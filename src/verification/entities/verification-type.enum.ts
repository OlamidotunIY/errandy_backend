import { registerEnumType } from '@nestjs/graphql';

export enum VerificationType {
  IDENTITY = 'IDENTITY',
  PHONE = 'PHONE',
  ADDRESS = 'ADDRESS',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  PROFESSIONAL_LICENSE = 'PROFESSIONAL_LICENSE',
  BUSINESS_REGISTRATION = 'BUSINESS_REGISTRATION',
}

registerEnumType(VerificationType, {
  name: 'VerificationType',
});
