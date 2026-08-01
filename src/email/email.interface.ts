export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  from?: string;
  template?: string;
  context?: Record<string, unknown>;
  html?: string;
  text?: string;
  replyTo?: string;
}