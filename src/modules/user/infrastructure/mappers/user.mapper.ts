import { Injectable } from '@nestjs/common';
import { User as PrismaUser, Role, OnboardingProgress } from '@prisma/client';
import { User } from '../../domain/entities/user.entity';
import { UserId } from '../../domain/value-objects/user.id';

@Injectable()
export class UserMapper {
  toDomain(raw: PrismaUser): User {
    return new User(
      UserId.fromString(raw.id),
      raw.name,
      raw.email,
      raw.emailVerified,
      raw.image,
      raw.phoneNumber,
      raw.phoneNumberVerified,
      raw.username,
      raw.displayUsername,
      raw.twoFactorEnabled,
      raw.activeAddressId,
      raw.chatRoomIds,
      raw.createdAt,
      raw.updatedAt,
    );
  }

  toPersistence(domain: User): PrismaUser {
    return {
      id: domain.id.value,
      name: domain.name,
      email: domain.email,
      emailVerified: domain.emailVerified,
      image: domain.image,
      phoneNumber: domain.phoneNumber,
      phoneNumberVerified: domain.phoneNumberVerified,
      username: domain.username,
      displayUsername: domain.displayUsername,
      twoFactorEnabled: domain.twoFactorEnabled,
      activeAddressId: domain.activeAddressId,
      chatRoomIds: domain.chatRoomIds,
      role: Role.USER,
      onboardingProgress: OnboardingProgress.NONE,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    };
  }
}
