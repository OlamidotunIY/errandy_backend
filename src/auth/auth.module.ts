import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma.service';
import { AuthHook } from './auth.hook';

@Module({
  imports: [],
  providers: [AuthService, PrismaService, AuthHook],
  controllers: [],
})
export class AuthModule {}
