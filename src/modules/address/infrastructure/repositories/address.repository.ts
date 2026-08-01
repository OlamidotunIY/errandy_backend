import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Address, IAddressRepository } from '@module/address';
import { AddressId } from '@module/address';
import { UserId } from '@module/user';
import { AddressMapper } from '../mappers';

@Injectable()
export class PrismaAddressRepository implements IAddressRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: AddressMapper,
  ) {}

  async save(address: Address): Promise<void> {
    const data = this.mapper.toPersistence(address);

    await this.prisma.userAddress.upsert({
      where: { id: address.id.value },
      create: data,
      update: data,
    });
  }

  async findById(id: AddressId): Promise<Address | null> {
    const record = await this.prisma.userAddress.findUnique({
      where: { id: id.value },
    });

    return record ? this.mapper.toDomain(record) : null;
  }

  async findByUserId(id: UserId): Promise<Address[]> {
    const records = await this.prisma.userAddress.findMany({
      where: { userId: id.value },
    });

    return records.map((record) => this.mapper.toDomain(record));
  }

  async delete(id: AddressId): Promise<void> {
    await this.prisma.userAddress.delete({
      where: { id: id.value },
    });
  }
}
