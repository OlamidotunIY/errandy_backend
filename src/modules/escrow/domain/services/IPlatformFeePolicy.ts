import { ClientId } from '@module/clients';
import { ErrandId } from '@module/errand';

interface IPlatformFeePolicy {
  resolveFeeRate(errandId: ErrandId, clientId: ClientId): Promise<number>;
}

export { IPlatformFeePolicy };
