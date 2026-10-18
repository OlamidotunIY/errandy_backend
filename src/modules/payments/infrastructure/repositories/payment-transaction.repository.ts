import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { IPaymentTransactionRepository, PaymentTransaction } from '../../domain';
import { PaymentMapper } from '../mappers';

@Injectable()
export class PrismaPaymentTransactionRepository
  implements IPaymentTransactionRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: PaymentMapper,
  ) {}

  async save(transaction: PaymentTransaction): Promise<void> {
    const data = this.mapper.toTransactionPersistence(transaction);

    await this.prisma.paymentTransaction.upsert({
      where: { id: transaction.id.toString() },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<PaymentTransaction | null> {
    const record = await this.prisma.paymentTransaction.findUnique({
      where: { id },
    });

    return record ? this.mapper.toTransactionDomain(record) : null;
  }

  async findByGatewayReference(
    reference: string,
  ): Promise<PaymentTransaction | null> {
    const record = await this.prisma.paymentTransaction.findFirst({
      where: { gatewayReference: reference },
    });

    return record ? this.mapper.toTransactionDomain(record) : null;
  }

  async findByPurposeId(
    purposeId: string,
  ): Promise<PaymentTransaction | null> {
    const record = await this.prisma.paymentTransaction.findFirst({
      where: { purposeId },
      orderBy: { createdAt: 'desc' },
    });

    return record ? this.mapper.toTransactionDomain(record) : null;
  }
}
