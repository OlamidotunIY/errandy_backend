import { Injectable } from '@nestjs/common';
import { CreateApplicationInput } from './dto/create-application.input';
import { UpdateApplicationInput } from './dto/update-application.input';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class ApplicationService {
  constructor(private readonly prisma: PrismaService) {}

  async apply(createApplicationInput: CreateApplicationInput, userId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new Error('User does not have a provider profile');
    }

    return this.prisma.application.create({
      data: {
        ...createApplicationInput,
        workerId: provider.id,
        status: 'PENDING',
      },
    });
  }
}
