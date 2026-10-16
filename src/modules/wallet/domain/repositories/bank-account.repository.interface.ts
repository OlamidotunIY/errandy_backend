export interface BankAccountRecord {
  id: string;
  ownerId: string;
  currency: string;
  bankCode: string;
  accountNumber: string;
  accountName?: string | null;
  isVerified: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class IBankAccountRepository {
  abstract save(
    account: Omit<BankAccountRecord, 'createdAt' | 'updatedAt'>,
  ): Promise<BankAccountRecord>;
  abstract findById(id: string): Promise<BankAccountRecord | null>;
  abstract findByOwnerId(ownerId: string): Promise<BankAccountRecord[]>;
  abstract findDefaultByOwnerId(
    ownerId: string,
  ): Promise<BankAccountRecord | null>;
  abstract delete(id: string): Promise<void>;
}
