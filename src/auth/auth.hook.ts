import { Injectable } from '@nestjs/common';
import { Hook, AuthHookContext, AfterHook } from '@thallesp/nestjs-better-auth';
import { AuthService } from './auth.service';

@Hook()
@Injectable()
export class AuthHook {
  constructor(private readonly authService: AuthService) {}

  @AfterHook('/sign-up/email')
  async handleSignUpEmail(ctx: AuthHookContext) {
    // After successful email sign-up, handle post-signup logic
    // This includes emitting events for Paystack customer creation
    if (ctx.body?.email) {
      await this.authService.handleSignUpComplete(ctx.body.email);
    }
  }
}