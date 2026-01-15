import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { SendEmailOptions } from './email.interface';

export type EmailType = 'promotional' | 'transactional';

// Template IDs from Resend (will be populated after running setup script)
// Run: npx ts-node scripts/setup-resend-templates.ts
const TEMPLATE_IDS: Record<string, string> = {
  welcome: process.env.RESEND_TEMPLATE_WELCOME || '',
  'verification-otp': process.env.RESEND_TEMPLATE_VERIFICATION_OTP || '',
  'reset-password-otp': process.env.RESEND_TEMPLATE_RESET_PASSWORD_OTP || '',
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;

  // Sender emails (must be verified in Resend)
  private readonly PROMOTIONAL_FROM =
    'Dotun from Errandy <dotuniyanda@errandy.com.ng>';
  private readonly TRANSACTIONAL_FROM =
    'Errandy <no-reply@errandy.com.ng>';

  constructor() {
    this.resend = new Resend(process.env.RESEND_API);
    this.logger.log('EmailService initialized with Resend');
  }

  /**
   * Send an email using Resend templates
   * @param options - Email options
   * @param type - 'promotional' (default) for marketing/welcome emails, 'transactional' for OTP/verification
   */
  async sendEmail(
    options: SendEmailOptions,
    type: EmailType = 'promotional',
  ): Promise<boolean> {
    const from =
      options.from ||
      (type === 'transactional'
        ? this.TRANSACTIONAL_FROM
        : this.PROMOTIONAL_FROM);

    const to = Array.isArray(options.to) ? options.to : [options.to];

    try {
      // Use template if specified and template ID exists
      if (options.template && TEMPLATE_IDS[options.template]) {
        const { data, error } = await this.resend.emails.send({
          from,
          to,
          subject: options.subject,
          template: {
            id: TEMPLATE_IDS[options.template],
            variables: options.context || {},
          },
        } as Parameters<typeof this.resend.emails.send>[0]);

        if (error) {
          this.logger.error(
            `[${type}] Failed to send email to ${options.to}: ${error.message}`,
          );
          throw new Error(error.message);
        }

        this.logger.log(`[${type}] Email sent to ${options.to}: ${data?.id}`);
        return true;
      }

      // Fallback to raw HTML
      const emailPayload = {
        from,
        to,
        subject: options.subject,
        html: options.html || '',
        ...(options.text && { text: options.text }),
        ...(options.replyTo && { replyTo: options.replyTo }),
      } as Parameters<typeof this.resend.emails.send>[0];

      const { data, error } = await this.resend.emails.send(emailPayload);

      if (error) {
        this.logger.error(
          `[${type}] Failed to send email to ${options.to}: ${error.message}`,
        );
        throw new Error(error.message);
      }

      this.logger.log(`[${type}] Email sent to ${options.to}: ${data?.id}`);
      return true;
    } catch (error: any) {
      this.logger.error(
        `[${type}] Failed to send email to ${options.to}: ${error.message}`,
      );
      throw error;
    }
  }
}
