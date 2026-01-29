import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationResolver } from './organization.resolver';
import { PrismaService } from 'src/prisma.service';


@Module({
  imports: [],
  providers: [OrganizationService, OrganizationResolver, PrismaService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
