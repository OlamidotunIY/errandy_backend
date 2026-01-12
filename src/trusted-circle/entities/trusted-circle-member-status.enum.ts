import { registerEnumType } from '@nestjs/graphql';

export enum TrustedCircleMemberStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING',
}

registerEnumType(TrustedCircleMemberStatus, {
  name: 'TrustedCircleMemberStatus',
});
