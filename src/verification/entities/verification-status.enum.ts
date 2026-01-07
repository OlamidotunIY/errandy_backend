import { registerEnumType } from '@nestjs/graphql';

export enum VerificationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

registerEnumType(VerificationStatus, {
  name: 'VerificationStatus',
});
