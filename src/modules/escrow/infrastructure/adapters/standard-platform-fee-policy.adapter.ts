import { Injectable } from '@nestjs/common';
import { IPlatformFeePolicy } from '../../domain/services';
import { PartyId } from '@module/party';
import { ErrandId } from '@module/errands';

@Injectable()
export class StandardPlatformFeePolicy implements IPlatformFeePolicy {
  async resolveFeeRate(
    errandId: ErrandId,
    clientPartyId: PartyId,
  ): Promise<number> {
    // Standard marketplace fee rate is 10%
    return 0.1;
  }
}
