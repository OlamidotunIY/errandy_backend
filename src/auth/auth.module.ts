import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from '../../auth';
import { AuthController } from './auth.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  imports: [BetterAuthModule.forRoot(auth)],
  providers: [
    AuthService,
    {
      provide: 'BETTER_AUTH_INSTANCE',
      useValue: auth, // ✅ make it injectable
    },
    PrismaService,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
