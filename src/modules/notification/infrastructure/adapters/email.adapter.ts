import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { NotificationDeliveryError } from '../../domain';

export type EmailType = 'SYSTEM' | 'ADMIN_BROADCAST';

@Injectable()
export class EmailAdapter {
  private readonly logger = new Logger(EmailAdapter.name);
  private readonly resend: Resend;

  private readonly SYSTEM_FROM = 'Errandy <noreply@errandy.name.ng>';

  constructor() {
    this.resend = new Resend(process.env.RESEND_API);
    this.logger.log('EmailAdapter initialized with Resend');
  }

  async send(payload: Record<string, unknown>): Promise<void> {
    const toRaw = payload.to as string | string[] | undefined;
    const subject = payload.subject as string | undefined;

    if (!toRaw || !subject || !payload.template) {
      throw new NotificationDeliveryError(
        'EMAIL',
        'payload must include "to", "subject", and "template"',
      );
    }

    const to = Array.isArray(toRaw) ? toRaw : [toRaw];
    const type = (payload.emailType as EmailType) ?? 'SYSTEM';

    let from = this.SYSTEM_FROM;
    if (type === 'ADMIN_BROADCAST') {
      if (!payload.from) {
        throw new NotificationDeliveryError('EMAIL', 'ADMIN_BROADCAST requires a "from" email address');
      }
      from = payload.from as string;
    }

    try {
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
      });

      if (error) {
        this.logger.error(`[${type}] Failed to send email to ${to.join(', ')}: ${error.message}`);
        throw new NotificationDeliveryError('EMAIL', error.message);
      }

      this.logger.log(`[${type}] Email sent to ${to.join(', ')}: ${data?.id}`);
    } catch (error: any) {
      this.logger.error(`[${type}] Failed to send email to ${to.join(', ')}: ${error.message}`);
      if (error instanceof NotificationDeliveryError) throw error;
      throw new NotificationDeliveryError('EMAIL', error.message);
    }
  }

  async sendBatch(payloads: Array<{ from: string; to: string[]; subject: string; template: string; context?: any }>): Promise<void> {
    const globalVariables = {
      year: new Date().getFullYear(),
      unsubscribeUrl: 'https://errandy.app/unsubscribe',
      companyName: 'Errandy',
      companyAddress: 'Lagos, Nigeria',
    };

    // Resend batch allows up to 100 emails per request
    const CHUNK_SIZE = 100;
    for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
      const chunk = payloads.slice(i, i + CHUNK_SIZE);
      const batchPayload = chunk.map((p) => ({
        from: p.from,
        to: p.to,
        subject: p.subject,
        template: {
          id: p.template,
          variables: {
            ...globalVariables,
            ...p.context,
          },
        },
      }));

      try {
        const { error } = await this.resend.batch.send(batchPayload);
        if (error) {
          this.logger.error(`Failed to send batch chunk ${i}: ${error.message}`);
          throw new NotificationDeliveryError('EMAIL', error.message);
        }
        this.logger.log(`Sent batch chunk ${i} to ${i + chunk.length}`);
      } catch (error: any) {
        this.logger.error(`Failed to send batch chunk ${i}: ${error.message}`);
        throw new NotificationDeliveryError('EMAIL', error.message);
      }
    }
  }

  async createTemplate(payload: { name: string; subject: string; html: string; text?: string }): Promise<any> {
    try {
      const { data, error } = await this.resend.templates.create(payload);
      if (error) {
        throw new Error(error.message);
      }
      return data;
    } catch (error: any) {
      this.logger.error(`Failed to create template: ${error.message}`);
      throw error;
    }
  }

  async getTemplate(resendTemplateId: string): Promise<any> {
    try {
      const { data, error } = await this.resend.templates.get(resendTemplateId);
      if (error) {
        throw new Error(error.message);
      }
      return data;
    } catch (error: any) {
      this.logger.error(`Failed to get template ${resendTemplateId}: ${error.message}`);
      throw error;
    }
  }

  async updateTemplate(resendTemplateId: string, payload: { name: string; subject: string; html: string; text?: string }): Promise<any> {
    try {
      const { data, error } = await this.resend.templates.update(resendTemplateId, payload);
      if (error) {
        throw new Error(error.message);
      }
      return data;
    } catch (error: any) {
      this.logger.error(`Failed to update template ${resendTemplateId}: ${error.message}`);
      throw error;
    }
  }
}
