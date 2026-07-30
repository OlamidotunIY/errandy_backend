import { registerEnumType } from '@nestjs/graphql';

export enum ApplicationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

registerEnumType(ApplicationStatus, {
  name: 'ApplicationStatus',
});