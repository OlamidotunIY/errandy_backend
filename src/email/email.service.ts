import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { SendEmailOptions } from './email.interface';

export type EmailType = 'promotional' | 'transactional';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private promotionalTransporter: Transporter;
  private transactionalTransporter: Transporter;
  private templateCache: Map<string, Handlebars.TemplateDelegate> = new Map();
  private baseTemplate: Handlebars.TemplateDelegate | null = null;
  private readonly templatesDir: string;
  private logoBase64: string = '';

  // Sender display names
  private readonly PROMOTIONAL_SENDER_NAME = 'Dotun from Errandy';
  private readonly TRANSACTIONAL_SENDER_NAME = 'Errandy';

  constructor() {
    // Try dist path first (production), fallback to src (development)
    const distPath = path.join(__dirname, 'templates');
    const srcPath = path.join(process.cwd(), 'src/email/templates');

    this.templatesDir = fs.existsSync(distPath) ? distPath : srcPath;

    this.initializeTransporters();
    this.registerPartials();
    this.loadLogo();
  }

  private initializeTransporters() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587');
    const secure = process.env.SMTP_SECURE === 'true';

    // Promotional transporter (user1) - for welcome emails, marketing, etc.
    this.promotionalTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: true,
      },
      connectionTimeout: 20_000,
    });

    // Transactional transporter (user2/no-reply) - for OTPs, verifications.
    this.transactionalTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER2,
        pass: process.env.SMTP_PASS2,
      },
      tls: {
        rejectUnauthorized: true,
      },
      connectionTimeout: 20_000,
    });

    this.promotionalTransporter.verify((error) => {
      if (error) {
        this.logger.error(
          'Promotional email transporter failed:',
          error.message,
        );
      } else {
        this.logger.log('Promotional email transporter ready');
      }
    });

    this.transactionalTransporter.verify((error) => {
      if (error) {
        this.logger.error(
          'Transactional email transporter failed:',
          error.message,
        );
      } else {
        this.logger.log('Transactional email transporter ready');
      }
    });
  }

  private loadLogo() {
    const logoPath = path.join(this.templatesDir, 'logo.png');

    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      this.logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      this.logger.log('Logo loaded successfully');
    } else {
      this.logger.warn('Logo file not found at templates/logo.png');
    }
  }

  private registerPartials() {
    const basePath = path.join(this.templatesDir, 'base.hbs');

    if (fs.existsSync(basePath)) {
      const baseSource = fs.readFileSync(basePath, 'utf-8');
      Handlebars.registerPartial('base', baseSource);
      this.baseTemplate = Handlebars.compile(baseSource);
      this.logger.log('Registered base template partial');
    }
  }

  private loadTemplate(templateName: string): Handlebars.TemplateDelegate {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Email template not found: ${templateName}`);
    }

    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const compiledTemplate = Handlebars.compile(templateSource);

    this.templateCache.set(templateName, compiledTemplate);
    return compiledTemplate;
  }

  /**
   * Send an email
   * @param options - Email options
   * @param type - 'promotional' (default) for marketing/welcome emails, 'transactional' for OTP/verification
   */
  async sendEmail(
    options: SendEmailOptions,
    type: EmailType = 'promotional',
  ): Promise<boolean> {
    const transporter =
      type === 'transactional'
        ? this.transactionalTransporter
        : this.promotionalTransporter;

    const senderName =
      type === 'transactional'
        ? this.TRANSACTIONAL_SENDER_NAME
        : this.PROMOTIONAL_SENDER_NAME;

    const senderEmail =
      type === 'transactional' ? process.env.SMTP_USER2 : process.env.SMTP_USER;

    // Format: "Display Name <email@example.com>"
    const from = options.from || `${senderName} <${senderEmail}>`;

    let html = options.html;

    if (options.template) {
      const template = this.loadTemplate(options.template);
      const context = {
        ...options.context,
        logoUrl: this.logoBase64,
        year: options.context?.year || new Date().getFullYear(),
        unsubscribeUrl:
          options.context?.unsubscribeUrl || 'https://errandy.app/unsubscribe',
        subject: options.subject,
      };

      // Render content template first
      const bodyContent = template(context);

      // Wrap in base template if available
      if (this.baseTemplate) {
        html = this.baseTemplate({ ...context, body: bodyContent });
      } else {
        html = bodyContent;
      }
    }

    try {
      const info = await transporter.sendMail({
        from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html,
        replyTo: options.replyTo,
        attachments: options.attachments,
      });

      this.logger.log(
        `[${type}] Email sent to ${options.to}: ${info.messageId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `[${type}] Failed to send email to ${options.to}: ${error.message}`,
      );
      throw error;
    }
  }
}
