import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  template?: string; // Template name (without .hbs extension)
  context?: Record<string, any>; // Template variables
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;
  private templateCache: Map<string, Handlebars.TemplateDelegate> = new Map();
  private readonly templatesDir: string;

  constructor() {
    this.templatesDir = path.join(process.cwd(), 'src/email/templates');
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587');
    const secure = process.env.SMTP_SECURE === 'true';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    this.transporter.verify((error) => {
      if (error) {
        this.logger.error(
          'Email transporter verification failed:',
          error.message,
        );
      } else {
        this.logger.log('Email transporter is ready to send emails');
      }
    });
  }

  /**
   * Load and compile a template
   */
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
   */
  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    const from = options.from || process.env.SMTP_FROM || process.env.SMTP_USER;

    let html = options.html;

    // If template is specified, compile it with context
    if (options.template) {
      const template = this.loadTemplate(options.template);
      html = template(options.context || {});
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html,
        replyTo: options.replyTo,
        attachments: options.attachments,
      });

      this.logger.log(
        `Email sent successfully to ${options.to}: ${info.messageId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${error.message}`,
      );
      throw error;
    }
  }
}
