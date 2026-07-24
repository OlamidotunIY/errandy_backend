import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { SendEmailOptions } from './email.interface';
import { ConfigService } from '@nestjs/config';

export type EmailType = 'promotional' | 'transactional';

const resend = new Resend(process.env.RESEND_API);

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  // Sender emails (must be verified in Resend)
  private readonly PROMOTIONAL_FROM =
    'Dotun from Errandy <dotuniyanda@errandy.com.ng>';
  private readonly TRANSACTIONAL_FROM = 'Errandy <no-reply@errandy.com.ng>';

  constructor() {
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
      // Use template if specified
      if (options.template) {
        // Prepare global variables
        const globalVariables = {
          year: new Date().getFullYear(),
          unsubscribeUrl: 'https://errandy.app/unsubscribe', // Placeholder
          companyName: 'Errandy',
          companyAddress: 'Lagos, Nigeria',
        };

        const { data, error } = await resend.emails.send({
          from,
          to,
          subject: options.subject,
          template: {
            id: options.template, // Use the slug provided directly (e.g., 'welcome')
            variables: {
              ...globalVariables,
              ...(options.context || {}),
            },
          },
        } as Parameters<typeof resend.emails.send>[0]);

        if (error) {
          this.logger.error(
            `[${type}] Failed to send email to ${options.to as string}: ${error.message}`,
          );
          throw new Error(error.message);
        }

        this.logger.log(
          `[${type}] Email sent to ${options.to as string}: ${data?.id}`,
        );
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
      } as Parameters<typeof resend.emails.send>[0];

      const { data, error } = await resend.emails.send(emailPayload);

      if (error) {
        this.logger.error(
          `[${type}] Failed to send email to ${options.to as string}: ${error.message}`,
        );
        throw new Error(error.message);
      }

      this.logger.log(
        `[${type}] Email sent to ${options.to as string}: ${data?.id}`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `[${type}] Failed to send email to ${options.to as string}: ${error.message as string}`,
      );
      throw error;
    }
  }
}
