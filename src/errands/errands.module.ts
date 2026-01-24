import { Module } from '@nestjs/common';
import { ErrandsService } from './errands.service';
import { ErrandsResolver } from './errands.resolver';
import { PrismaService } from 'src/prisma.service';
import { UsersService } from 'src/users/users.service';
import { EscrowModule } from 'src/escrow/escrow.module';

@Module({
  imports: [EscrowModule],
  providers: [
    ErrandsResolver,
    ErrandsService,
    PrismaService,
    UsersService,
  ],
})
export class ErrandsModule {}
