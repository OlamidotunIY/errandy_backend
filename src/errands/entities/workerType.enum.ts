import { registerEnumType } from '@nestjs/graphql';

export enum WorkerType {
  PROFESSIONAL = 'PROFESSIONAL',
  GENERAL = 'GENERAL',
  ARTISAN = 'ARTISAN',
}

registerEnumType(WorkerType, {
  name: 'WorkerType',
});
