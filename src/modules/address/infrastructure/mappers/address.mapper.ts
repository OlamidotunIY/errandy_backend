import { Injectable } from '@nestjs/common';
import { UserAddress as PrismaUserAddress } from '@prisma/client';
import { InputJsonValue } from '@prisma/client/runtime/edge';
import { Address, Coordinates } from '@module/address';
import { AddressId } from '@module/address';
import { UserId } from '@module/user';

interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number];
}

@Injectable()
export class AddressMapper {
  toDomain(record: PrismaUserAddress): Address {
    const geoJson = record.coordinates as unknown as GeoJsonPoint;
    const coordinates = Coordinates.create(
      geoJson.coordinates[1],
      geoJson.coordinates[0],
    );

    return Address.reconstitute({
      id: AddressId.fromString(record.id),
      userId: UserId.fromString(record.userId),
      label: record.label,
      street: record.street,
      city: record.city,
      state: record.state,
      country: record.country,
      isDefault: record.isDefault,
      coordinates,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  toPersistence(address: Address): {
    id: string;
    userId: string;
    label: string;
    street: string;
    city: string;
    state: string;
    country: string;
    coordinates: InputJsonValue;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: address.id.value,
      userId: address.ownerUserId.value,
      label: address.label,
      street: address.street,
      city: address.city,
      state: address.state,
      country: address.country,
      coordinates: address.toGeoJson(),
      isDefault: address.isDefault,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }
}
