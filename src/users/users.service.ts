import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateAddressInput, CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from '@prisma/client';
import { UserRole } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findOne(id: string) {
    return this.prisma.user.findFirst({
      where: { id },
      include: { activeAddress: true },
    });
  }

  update(updateUserInput: UpdateUserInput) {
    return this.prisma.user.update({
      where: { id: updateUserInput.id },
      data: {
        ...updateUserInput,
        ...(updateUserInput.role && {
          roles: {
            push: updateUserInput.role, // add role to array
          },
          activeRole: updateUserInput.role, // set as active
        }),
      },
    });
  }

  addAddress(dto: CreateAddressInput, userId: string) {
    const geoLocation: Prisma.InputJsonValue = {
      type: 'Point',
      coordinates: [Number(dto.longitude), Number(dto.latitude)],
    };

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        activeAddress: {
          create: {
            label: dto.label,
            address: dto.address,
            location: geoLocation,
          },
        },
      },
    });
  }

  async switchRole(role: UserRole, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id },
    });

    const roles = user?.roles;

    if (!roles?.includes[role]) {
      await this.prisma.user.update({
        where: { id },
        data: {
          roles: {
            push: role,
          },
        },
      });
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        activeRole: role,
      },
    });
  }
}
