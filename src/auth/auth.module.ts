import { Module } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma.service';
import { AuthHook } from './auth.hook';
import { auth } from '../../auth';

@Module({
  imports: [BetterAuthModule.forRoot(auth)],
  providers: [AuthService, PrismaService, AuthHook],
  controllers: [],
})
export class AuthModule {}
