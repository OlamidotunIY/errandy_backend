import { Module } from '@nestjs/common';
import { ErrandsService } from './errands.service';
import { ErrandsResolver } from './errands.resolver';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [ErrandsResolver, ErrandsService, PrismaService],
})
export class ErrandsModule {}
