import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { IPaymentMethodRepository, PaymentMethod } from '../../domain';
import { PaymentMapper } from '../mappers';

@Injectable()
export class PrismaPaymentMethodRepository implements IPaymentMethodRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: PaymentMapper,
  ) {}

  async save(method: PaymentMethod): Promise<void> {
    const data = this.mapper.toMethodPersistence(method);

    await this.prisma.paymentMethod.upsert({
      where: { id: method.id.value },
      create: data,
      update: data,
    });
  }

  async findById(id: string): Promise<PaymentMethod | null> {
    const record = await this.prisma.paymentMethod.findUnique({
      where: { id },
    });

    return record ? this.mapper.toMethodDomain(record) : null;
  }

  async findByPartyId(partyId: string): Promise<PaymentMethod[]> {
    const records = await this.prisma.paymentMethod.findMany({
      where: { partyId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => this.mapper.toMethodDomain(r));
  }

  async findDefaultByPartyId(partyId: string): Promise<PaymentMethod | null> {
    const record = await this.prisma.paymentMethod.findFirst({
      where: { partyId, isDefault: true, isActive: true },
    });

    return record ? this.mapper.toMethodDomain(record) : null;
  }
}
