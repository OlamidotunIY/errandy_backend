import { ClientId } from '@module/clients';
import { ErrandId } from '@module/errands';

interface IPlatformFeePolicy {
  resolveFeeRate(errandId: ErrandId, clientId: ClientId): Promise<number>;
}

export { IPlatformFeePolicy };
