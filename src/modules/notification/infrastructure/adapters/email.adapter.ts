import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { NotificationDeliveryError } from '../../domain';

export type EmailType = 'promotional' | 'transactional';

@Injectable()
export class EmailAdapter {
  private readonly logger = new Logger(EmailAdapter.name);
  private readonly resend: Resend;

  // Sender emails (must be verified in Resend)
  private readonly PROMOTIONAL_FROM = 'Dotun from Errandy <dotuniyanda@errandy.com.ng>';
  private readonly TRANSACTIONAL_FROM = 'Errandy <no-reply@errandy.com.ng>';

  constructor() {
    this.resend = new Resend(process.env.RESEND_API);
    this.logger.log('EmailAdapter initialized with Resend');
  }

  async send(payload: Record<string, unknown>): Promise<void> {
    const toRaw = payload.to as string | string[] | undefined;
    const subject = payload.subject as string | undefined;

    if (!toRaw || !subject) {
      throw new NotificationDeliveryError(
        'EMAIL',
        'payload must include "to" and "subject"',
      );
    }

    const to = Array.isArray(toRaw) ? toRaw : [toRaw];
    const type = (payload.emailType as EmailType) ?? 'transactional';
    
    const from =
      (payload.from as string) ||
      (type === 'transactional'
        ? this.TRANSACTIONAL_FROM
        : this.PROMOTIONAL_FROM);

    try {
      if (payload.template) {
        const globalVariables = {
          year: new Date().getFullYear(),
          unsubscribeUrl: 'https://errandy.app/unsubscribe',
          companyName: 'Errandy',
          companyAddress: 'Lagos, Nigeria',
        };

        const { data, error } = await this.resend.emails.send({
          from,
          to,
          subject,
          template: {
            id: payload.template as string,
            variables: {
              ...globalVariables,
              ...((payload.context as Record<string, unknown>) || {}),
            },
          },
        } as Parameters<typeof this.resend.emails.send>[0]);

        if (error) {
          this.logger.error(`[${type}] Failed to send email to ${to}: ${error.message}`);
          throw new NotificationDeliveryError('EMAIL', error.message);
        }

        this.logger.log(`[${type}] Email sent to ${to}: ${data?.id}`);
        return;
      }

      // Fallback to raw HTML
      const emailPayload = {
        from,
        to,
        subject,
        html: (payload.html as string) || '',
        ...(payload.text ? { text: payload.text as string } : {}),
        ...(payload.replyTo ? { replyTo: payload.replyTo as string } : {}),
      } as Parameters<typeof this.resend.emails.send>[0];

      const { data, error } = await this.resend.emails.send(emailPayload);

      if (error) {
        this.logger.error(`[${type}] Failed to send email to ${to}: ${error.message}`);
        throw new NotificationDeliveryError('EMAIL', error.message);
      }

      this.logger.log(`[${type}] Email sent to ${to}: ${data?.id}`);
    } catch (error: any) {
      this.logger.error(`[${type}] Failed to send email to ${to}: ${error.message}`);
      if (error instanceof NotificationDeliveryError) throw error;
      throw new NotificationDeliveryError('EMAIL', error.message);
    }
  }
}
