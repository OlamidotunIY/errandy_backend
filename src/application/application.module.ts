import { Module } from '@nestjs/common';
import { ApplicationService } from './application.service';
import { ApplicationResolver } from './application.resolver';
import { PrismaService } from 'src/prisma.service';
import { EscrowModule } from 'src/escrow/escrow.module';

@Module({
  imports: [EscrowModule],
  providers: [ApplicationResolver, ApplicationService, PrismaService],
})
export class ApplicationModule {}
