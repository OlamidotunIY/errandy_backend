import { registerEnumType } from '@nestjs/graphql';

export enum TxStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

registerEnumType(TxStatus, {
  name: 'TxStatus',
});
