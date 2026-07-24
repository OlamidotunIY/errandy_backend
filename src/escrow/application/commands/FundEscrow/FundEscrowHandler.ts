import {
  FundEscrowCommand,
  IEscrowRepository,
  IPlatformFeePolicy,
} from '@escrow';
import { ILogger } from '@shared';
import { WalletRepository } from '@wallet';
import { FundEscrowResult } from './FundEscrowResult';

class FundEscrowHandler {
  constructor(
    private readonly escrowRepository: IEscrowRepository,
    private readonly walletRepository: WalletRepository,
    private readonly feePolicy: IPlatformFeePolicy,
    private readonly logger: ILogger,
  ) {}

  async execute(command: FundEscrowCommand): Promise<FundEscrowResult> {
    return await Promise.resolve({} as FundEscrowResult);
  }
}

export { FundEscrowHandler };
