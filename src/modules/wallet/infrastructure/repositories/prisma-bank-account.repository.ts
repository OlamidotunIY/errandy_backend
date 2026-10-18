import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import {
  IBankAccountRepository,
  BankAccountRecord,
} from '../../domain/repositories';

@Injectable()
export class PrismaBankAccountRepository implements IBankAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(
    account: Omit<BankAccountRecord, 'createdAt' | 'updatedAt'>,
  ): Promise<BankAccountRecord> {
    const record = await this.prisma.bankAccount.upsert({
      where: { id: account.id },
      create: {
        id: account.id,
        ownerId: account.ownerId,
        currency: account.currency,
        bankCode: account.bankCode,
        accountNumber: account.accountNumber,
        accountName: account.accountName ?? null,
        isVerified: account.isVerified,
        isDefault: account.isDefault,
      },
      update: {
        currency: account.currency,
        bankCode: account.bankCode,
        accountNumber: account.accountNumber,
        accountName: account.accountName ?? null,
        isVerified: account.isVerified,
        isDefault: account.isDefault,
      },
    });

    return record;
  }

  async findById(id: string): Promise<BankAccountRecord | null> {
    return this.prisma.bankAccount.findUnique({
      where: { id },
    });
  }

  async findByOwnerId(ownerId: string): Promise<BankAccountRecord[]> {
    return this.prisma.bankAccount.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findDefaultByOwnerId(
    ownerId: string,
  ): Promise<BankAccountRecord | null> {
    return this.prisma.bankAccount.findFirst({
      where: { ownerId, isDefault: true },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.bankAccount.delete({
      where: { id },
    });
  }
}
