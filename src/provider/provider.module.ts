import { Module } from '@nestjs/common';
import { ProviderService } from './provider.service';
import { ProviderResolver } from './provider.resolver';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [ProviderService, ProviderResolver, PrismaService],
})
export class ProviderModule {}
