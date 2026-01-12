import { Module } from '@nestjs/common';
import { TrustedCircleService } from './trusted-circle.service';
import { TrustedCircleResolver } from './trusted-circle.resolver';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [TrustedCircleResolver, TrustedCircleService, PrismaService],
})
export class TrustedCircleModule {}
