import { registerEnumType } from '@nestjs/graphql';

export enum ErrandStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DRAFT = 'DRAFT'
}

registerEnumType(ErrandStatus, {
  name: 'ErrandStatus',
});
