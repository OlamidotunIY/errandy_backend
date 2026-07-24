import { Currency } from '@escrow';
import { UserId } from '@user';

interface RecordWithdrawalCommand {
  userId: UserId;
  amountKobo: number;
  currency: Currency;
  gatewayReference: string;
}

export { RecordWithdrawalCommand };
