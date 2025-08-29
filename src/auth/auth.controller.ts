import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    try {
      return await this.authService.signInWithUsername(dto);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    try {
      return await this.authService.signUpWithEmail(dto);
    } catch (error) {
      throw error;
    }
  }

  @Post('callback/google')
  async googleAuthCallback() {
    try {
      return await this.authService.signInWithGoogle();
    } catch (error) {
      throw error;
    }
  }
}
