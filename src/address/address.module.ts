import { Module } from '@nestjs/common';
import { AddressService } from './address.service';
import { AddressResolver } from './address.resolver';
import { UsersModule } from 'src/users/users.module';


@Module({
  imports: [UsersModule],
  providers: [AddressService, AddressResolver],
})
export class AddressModule {}
