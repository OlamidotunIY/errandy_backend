import { registerEnumType } from '@nestjs/graphql';

export enum CircleSource {
  COMPLETED_TASK = 'COMPLETED_TASK',
  MANUAL_ADD = 'MANUAL_ADD',
  INVITED = 'INVITED',
}

registerEnumType(CircleSource, {
  name: 'CircleSource',
});
