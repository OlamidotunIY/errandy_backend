import { registerEnumType } from '@nestjs/graphql';

export enum ErrandStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  OVERDUE = 'OVERDUE',
}

registerEnumType(ErrandStatus, {
  name: 'ErrandStatus',
});
