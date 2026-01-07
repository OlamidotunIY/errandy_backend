import { registerEnumType } from '@nestjs/graphql';

export enum DisputeStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

registerEnumType(DisputeStatus, {
  name: 'DisputeStatus',
});
