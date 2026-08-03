import { PartyId } from '@module/party';
import { ErrandId } from '@module/errands';

interface IPlatformFeePolicy {
  resolveFeeRate(errandId: ErrandId, clientId: PartyId): Promise<number>;
}

export { IPlatformFeePolicy };
