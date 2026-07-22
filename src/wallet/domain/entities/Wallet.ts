import { AggregateRoot } from '@shared';
import { WalletId } from '../value-objects';

class Wallet extends AggregateRoot<WalletId> {}

export { Wallet };
