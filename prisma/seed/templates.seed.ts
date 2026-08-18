import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API || 're_dummy');

const DEFAULT_TEMPLATES = [
  {
    type: 'welcome-email',
    name: 'Errandy Welcome Email',
    subject: 'Welcome to Errandy!',
    html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <h2 style="color: #333333; margin-top: 0;">Welcome to {{{companyName}}}!</h2>
    <p style="color: #555555; line-height: 1.6;">Hi {{{name}}},</p>
    <p style="color: #555555; line-height: 1.6;">We're thrilled to have you on board! Errandy connects you with trusted individuals to help you get things done, safely and securely.</p>
    <p style="color: #555555; line-height: 1.6;">If you have any questions or need help getting started, just reply to this email.</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888888; font-size: 12px;">
    <p>&copy; {{{year}}} {{{companyName}}}. All rights reserved.</p>
    <p>{{{companyAddress}}}</p>
  </div>
</div>
    `,
  },
  {
    type: 'verify-email',
    name: 'Errandy Verify Email',
    subject: 'Verify your email address',
    html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <h2 style="color: #333333; margin-top: 0;">Verify your email address</h2>
    <p style="color: #555555; line-height: 1.6;">Hi there,</p>
    <p style="color: #555555; line-height: 1.6;">Welcome to {{{companyName}}}! Please verify your email address by using the code below:</p>
    <div style="margin: 30px 0; padding: 15px; background-color: #f0f4f8; text-align: center; border-radius: 4px;">
      <span style="font-size: 24px; font-weight: bold; color: #0056b3; letter-spacing: 2px;">{{{token}}}</span>
    </div>
    <p style="color: #555555; line-height: 1.6;">If you didn't request this, you can safely ignore this email.</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888888; font-size: 12px;">
    <p>&copy; {{{year}}} {{{companyName}}}. All rights reserved.</p>
    <p>{{{companyAddress}}}</p>
  </div>
</div>
    `,
  },
  {
    type: 'reset-password',
    name: 'Errandy Reset Password',
    subject: 'Reset your password',
    html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <h2 style="color: #333333; margin-top: 0;">Reset your password</h2>
    <p style="color: #555555; line-height: 1.6;">Hi there,</p>
    <p style="color: #555555; line-height: 1.6;">We received a request to reset the password for your {{{companyName}}} account. Use the code below to proceed:</p>
    <div style="margin: 30px 0; padding: 15px; background-color: #f0f4f8; text-align: center; border-radius: 4px;">
      <span style="font-size: 24px; font-weight: bold; color: #0056b3; letter-spacing: 2px;">{{{token}}}</span>
    </div>
    <p style="color: #555555; line-height: 1.6;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888888; font-size: 12px;">
    <p>&copy; {{{year}}} {{{companyName}}}. All rights reserved.</p>
    <p>{{{companyAddress}}}</p>
  </div>
</div>
    `,
  },
  {
    type: 'change-email',
    name: 'Errandy Change Email',
    subject: 'Verify your new email address',
    html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <h2 style="color: #333333; margin-top: 0;">Verify your new email address</h2>
    <p style="color: #555555; line-height: 1.6;">Hi there,</p>
    <p style="color: #555555; line-height: 1.6;">You've requested to change the email address associated with your {{{companyName}}} account. Please use the verification code below to confirm this change:</p>
    <div style="margin: 30px 0; padding: 15px; background-color: #f0f4f8; text-align: center; border-radius: 4px;">
      <span style="font-size: 24px; font-weight: bold; color: #0056b3; letter-spacing: 2px;">{{{token}}}</span>
    </div>
    <p style="color: #555555; line-height: 1.6;">If you didn't request this change, please secure your account immediately.</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888888; font-size: 12px;">
    <p>&copy; {{{year}}} {{{companyName}}}. All rights reserved.</p>
    <p>{{{companyAddress}}}</p>
  </div>
</div>
    `,
  },
];

export async function seedTemplates(prisma: PrismaClient, marketId: string) {
  if (!process.env.RESEND_API) {
    console.warn('⚠️ RESEND_API is not set, skipping template seeding.');
    return;
  }

  for (const templateData of DEFAULT_TEMPLATES) {
    const mapping = await prisma.notificationTemplate.findUnique({
      where: {
        marketId_type: { marketId, type: templateData.type },
      },
    });

    let resendTemplateExists = false;

    if (mapping) {
      try {
        const resendTemplate = await resend.templates.get(
          mapping.resendTemplateId,
        );
        if (resendTemplate && !resendTemplate.error) {
          resendTemplateExists = true;
        }
      } catch (err) {
        resendTemplateExists = false;
      }
    }

    if (resendTemplateExists) {
      console.log(
        `✅ Template '${templateData.type}' already exists and verified on Resend.`,
      );
      continue;
    }

    console.log(
      `Creating/Recreating template '${templateData.type}' on Resend...`,
    );

    const variableSet = new Set<string>();
    const tripleBraceRegex = /\{\{\{\s*([\w\.]+)\s*\}\}\}/g;

    let match;
    while ((match = tripleBraceRegex.exec(templateData.html)) !== null) {
      variableSet.add(match[1].trim());
    }

    const variables = Array.from(variableSet).map((key) => ({
      key,
      type: 'string' as const,
      fallbackValue: '',
    }));

    const { data: createdTemplate, error } = await resend.templates.create({
      name: `${templateData.name} (${marketId.substring(0, 8)})`,
      subject: templateData.subject,
      html: templateData.html,
      variables: variables.length > 0 ? variables : undefined,
    });

    if (error || !createdTemplate) {
      console.error(
        `❌ Failed to create template '${templateData.type}' on Resend:`,
        error,
      );
      continue;
    }

    await prisma.notificationTemplate.upsert({
      where: {
        marketId_type: { marketId, type: templateData.type },
      },
      update: {
        resendTemplateId: createdTemplate.id,
      },
      create: {
        marketId,
        type: templateData.type,
        resendTemplateId: createdTemplate.id,
      },
    });

    console.log(
      `✅ Template '${templateData.type}' successfully synced -> ID: ${createdTemplate.id}`,
    );
  }
}
