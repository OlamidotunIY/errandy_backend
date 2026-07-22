import { IEscrowRepository, IPlatformFeePolicy } from '@escrow';
import { ILogger } from '@shared';

class FundEscrowHandler {
  constructor(
    private readonly escrowRepository: IEscrowRepository,
    private readonly feePolicy: IPlatformFeePolicy,
    private readonly logger: ILogger,
  ) {}
}

export { FundEscrowHandler };
