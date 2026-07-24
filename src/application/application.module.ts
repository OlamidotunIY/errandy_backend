import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { EscrowModule } from 'src/escrow/escrow.module';

@Module({
  imports: [EscrowModule],
  providers: [PrismaService],
})
export class ApplicationModule {}
