import { ClientId } from '@client';
import { ErrandId } from '@errands';

interface IPlatformFeePolicy {
  resolveFeeRate(errandId: ErrandId, clientId: ClientId): Promise<number>;
}

export { IPlatformFeePolicy };
