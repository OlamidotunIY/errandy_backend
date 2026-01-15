import { Module } from '@nestjs/common';
import { ProviderService } from './provider.service';
import { ProviderResolver } from './provider.resolver';
import { PrismaService } from 'src/prisma.service';

import { RatingModule } from 'src/rating/rating.module';

@Module({
  imports: [RatingModule],
  providers: [ProviderService, ProviderResolver, PrismaService],
})
export class ProviderModule {}
