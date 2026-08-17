import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { EmailAdapter, SmsAdapter } from '@module/notification';
import { AuthUserRegisteredEvent } from '@module/user/domain';
import { randomUUID } from 'crypto';

@Injectable()
export class BetterAuthIntegration implements OnModuleInit {
  static instance: BetterAuthIntegration;

  constructor(
    private readonly eventBus: EventBus,
    private readonly emailAdapter: EmailAdapter,
    private readonly smsAdapter: SmsAdapter,
  ) {}

  onModuleInit() {
    BetterAuthIntegration.instance = this;
  }

  async handleUserCreated(user: any) {
    this.eventBus.publish(
      new AuthUserRegisteredEvent({
        userId: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        marketId: user.marketId || 'NG',
        role: user.role,
        correlationId: randomUUID(),
      }),
    );
  }

  async sendVerificationEmail({
    user,
    type,
    token,
  }: {
    user: any;
    type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';
    token: string;
  }) {
    let subject = 'Verify your email address';
    let template = 'verify-email';

    switch (type) {
      case 'sign-in':
        subject = 'Sign in to Errandy';
        template = 'sign-in';
        break;
      case 'email-verification':
        subject = 'Verify your email address';
        template = 'verify-email';
        break;
      case 'forget-password':
        subject = 'Reset your password';
        template = 'reset-password';
        break;
      case 'change-email':
        subject = 'Verify your new email address';
        template = 'change-email';
        break;
    }

    await this.emailAdapter.send({
      to: user.email,
      subject,
      template,
      context: { token },
      emailType: 'SYSTEM',
    });
  }

  async sendVerificationOTP({ phoneNumber, code }: any) {
    await this.smsAdapter.send({
      to: phoneNumber,
      body: `Your Errandy verification code is: ${code}`,
    });
  }
}
