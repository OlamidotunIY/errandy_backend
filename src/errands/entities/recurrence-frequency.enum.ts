import { registerEnumType } from '@nestjs/graphql';

export enum RecurrenceFrequency {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

registerEnumType(RecurrenceFrequency, {
  name: 'RecurrenceFrequency',
});
