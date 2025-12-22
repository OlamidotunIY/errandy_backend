import { Module } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { ApplicationResolver } from './application.resolver';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [ApplicationResolver, ApplicationService, PrismaService],
})
export class ApplicationModule {}
