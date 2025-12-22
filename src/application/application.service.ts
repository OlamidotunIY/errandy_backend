import { Injectable } from '@nestjs/common';
import { CreateApplicationInput } from './dto/create-application.input';
import { UpdateApplicationInput } from './dto/update-application.input';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class ApplicationService {
  constructor(
    private readonly prisma: PrismaService
  ) {}

  async apply(createApplicationInput: CreateApplicationInput, userId: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { userId },
    });

    if(!worker) {
      throw new Error('User does not have a worker profile');
    }


    return this.prisma.application.create({
      data: {
        ...createApplicationInput,
        workerId: worker.id,
        status: 'PENDING',
      },
    });
  }
}
