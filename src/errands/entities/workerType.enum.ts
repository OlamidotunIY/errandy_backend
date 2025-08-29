import { registerEnumType } from '@nestjs/graphql';

export enum WorkerType {
  PROFESSIONAL = 'PROFESSIONAL',
  GENERAL = 'GENERAL',
}

registerEnumType(WorkerType, {
  name: 'WorkerType',
});
