import { Inject, Injectable } from '@nestjs/common';
import { auth } from '../../auth';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,

    @Inject('BETTER_AUTH_INSTANCE')
    private readonly authInstance: typeof auth,

  ) {}

  async signUpWithEmail(dto: RegisterDto) {
    try {
      const result = await this.authInstance.api.signUpEmail({
        body: {
          name: dto.name,
          email: dto.email,
          password: dto.password,
          username: dto.username,
        },
      });

      if (result.token) {
        await this.authInstance.api.sendVerificationEmail({
          body: {
            email: dto.email,
          },
        });
      }

      return {
        user: result.user,
      };
    } catch (error) {
      throw error;
    }
  }

  async signInWithUsername(dto: LoginDto) {
    try {
      const result = await this.authInstance.api.signInUsername({
        body: {
          username: dto.username,
          password: dto.password,
        },
      });

      return {
        user: result,
      };
    } catch (error) {
      throw error;
    }
  }

  async signInWithGoogle() {
    try {
      const result = await this.authInstance.api.signInSocial({
        body: {
          provider: 'google',
        },
      });
      if ('user' in result) {
        return { user: result.user };
      } else {
        return result;
      }
    } catch (error) {
      throw error;
    }
  }
}
