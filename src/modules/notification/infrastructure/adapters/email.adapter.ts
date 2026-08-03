import { Injectable } from '@nestjs/common';
import { EmailService } from '@src/email/email.service';
import { NotificationDeliveryError } from '../../domain';

@Injectable()
export class EmailAdapter {
  constructor(private readonly emailService: EmailService) {}

  async send(payload: Record<string, unknown>): Promise<void> {
    const to = payload.to as string | string[] | undefined;
    const subject = payload.subject as string | undefined;

    if (!to || !subject) {
      throw new NotificationDeliveryError(
        'EMAIL',
        'payload must include "to" and "subject"',
      );
    }

    const sent = await this.emailService.sendEmail(
      {
        to,
        subject,
        template: payload.template as string | undefined,
        context: payload.context as Record<string, unknown> | undefined,
        html: payload.html as string | undefined,
        text: payload.text as string | undefined,
      },
      (payload.emailType as 'promotional' | 'transactional') ?? 'transactional',
    );

    if (!sent) {
      throw new NotificationDeliveryError(
        'EMAIL',
        'email provider failed to send the message',
      );
    }
  }
}
