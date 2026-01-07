import { registerEnumType } from '@nestjs/graphql';

export enum TxType {
  FUND = 'FUND',
  ESCROW_HOLD = 'ESCROW_HOLD',
  ESCROW_RELEASE = 'ESCROW_RELEASE',
  WITHDRAWAL = 'WITHDRAWAL',
}

registerEnumType(TxType, {
  name: 'TxType',
});
