import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { NotificationDeliveryError } from '../../domain';

@Injectable()
export class SmsAdapter {
  private readonly logger = new Logger(SmsAdapter.name);
  private readonly publicKey: string | undefined;
  private readonly senderName: string;
  private readonly route: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.publicKey = this.configService.get<string>('SENDCHAMP_PUBLIC_KEY');
    this.senderName =
      this.configService.get<string>('SENDCHAMP_SENDER_NAME') || 'Errandy';
    this.route =
      this.configService.get<string>('SENDCHAMP_ROUTE') || 'non_dnd';
    this.baseUrl =
      this.configService.get<string>('SENDCHAMP_BASE_URL') ||
      'https://api.sendchamp.com/api/v1/sms/send';
  }

  /**
   * Sendchamp requires recipient phone numbers in international format without the leading '+'.
   * Handles local Nigerian numbers (e.g. 08012345678 -> 2348012345678) as well as +234...
   */
  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = '234' + cleaned.slice(1);
    }
    return cleaned;
  }

  async send(payload: Record<string, unknown>): Promise<void> {
    const to = payload.to as string | undefined;
    const body =
      (payload.body as string | undefined) ||
      (payload.message as string | undefined);

    if (!to || !body) {
      throw new NotificationDeliveryError(
        'SMS',
        'payload must include "to" and "body"',
      );
    }

    if (!this.publicKey) {
      this.logger.warn(
        `SENDCHAMP_PUBLIC_KEY not configured. SMS to ${to} was skipped: "${body}"`,
      );
      return;
    }

    const formattedPhone = this.formatPhoneNumber(to);

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          to: [formattedPhone],
          message: body,
          sender_name: this.senderName,
          route: this.route,
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.publicKey}`,
          },
          timeout: 15000,
        },
      );

      const data = response.data;
      if (data && data.status && data.status !== 'success') {
        const errorMsg =
          data.message || 'Sendchamp returned non-success response';
        throw new Error(errorMsg);
      }

      this.logger.log(`Sendchamp SMS successfully dispatched to ${formattedPhone}`);
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        (error instanceof Error ? error.message : 'unknown Sendchamp SMS error');

      this.logger.error(
        `Sendchamp SMS delivery failed to ${to} (${formattedPhone}): ${errorMessage}`,
      );

      throw new NotificationDeliveryError('SMS', errorMessage);
    }
  }
}
