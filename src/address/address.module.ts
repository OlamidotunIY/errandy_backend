import { Module } from '@nestjs/common';
import { AddressService } from './address.service';
import { AddressResolver } from './address.resolver';
import { UsersModule } from 'src/users/users.module';
import { UsersService } from 'src/users/users.service';
import { PrismaService } from 'src/prisma.service';


@Module({
  imports: [UsersModule],
  providers: [AddressService, AddressResolver, UsersService, PrismaService],
})
export class AddressModule {}
