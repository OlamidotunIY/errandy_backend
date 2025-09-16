import { Module } from '@nestjs/common';
import { ServiceService } from './service.service';
import { ServiceResolver } from './service.resolver';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [ServiceResolver, ServiceService, PrismaService],
})
export class ServiceModule {}
