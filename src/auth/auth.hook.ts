import { Injectable } from '@nestjs/common';
import { Hook } from '@thallesp/nestjs-better-auth';

@Hook()
@Injectable()
export class AuthHook {
  // Post-signup logic (Paystack customer creation, etc.) is now handled
  // by databaseHooks.user.create.after in auth.ts for all auth methods
  // (email, Google, Apple). This hook class can be extended for other
  // auth-specific hooks if needed.
}
