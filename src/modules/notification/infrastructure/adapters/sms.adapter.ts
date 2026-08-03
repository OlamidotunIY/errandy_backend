import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { NotificationDeliveryError } from '../../domain';

@Injectable()
export class SmsAdapter {
  private readonly client: Twilio | null;
  private readonly fromNumber: string | undefined;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.configService.get<string>('TWILIO_FROM_NUMBER');

    this.client =
      accountSid && authToken ? new Twilio(accountSid, authToken) : null;
  }

  async send(payload: Record<string, unknown>): Promise<void> {
    const to = payload.to as string | undefined;
    const body = payload.body as string | undefined;

    if (!to || !body) {
      throw new NotificationDeliveryError(
        'SMS',
        'payload must include "to" and "body"',
      );
    }

    if (!this.client || !this.fromNumber) {
      throw new NotificationDeliveryError(
        'SMS',
        'no Twilio provider is configured for this deployment',
      );
    }

    try {
      await this.client.messages.create({
        to,
        body,
        from: this.fromNumber,
      });
    } catch (error) {
      throw new NotificationDeliveryError(
        'SMS',
        error instanceof Error ? error.message : 'unknown Twilio error',
      );
    }
  }
}
