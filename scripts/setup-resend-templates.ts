/**
 * Script to create/update email templates in Resend
 * Run with: npx ts-node scripts/setup-resend-templates.ts
 */
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API);

const LOGO_URL = 'https://errandy.com.ng/logo.png';
const YEAR = new Date().getFullYear();

const templates = [
  {
    name: 'welcome',
    subject: 'Welcome to Errandy! 🎉',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Errandy</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
    .container { background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
    .header { text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); }
    .logo { max-width: 150px; height: auto; }
    .content { padding: 30px; }
    .footer { text-align: center; padding: 20px; background-color: #f9fafb; color: #666; font-size: 14px; }
    .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white !important; text-decoration: none; border-radius: 8px; margin: 15px 0; font-weight: 600; }
    h1, h2, h3 { color: #1f2937; }
    a { color: #4f46e5; }
    .feature { display: flex; align-items: center; margin: 15px 0; }
    .feature-icon { font-size: 24px; margin-right: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_URL}" alt="Errandy" class="logo" />
    </div>
    <div class="content">
      <h1>Welcome to Errandy, {{{name}}}! 🎉</h1>
      <p>We're thrilled to have you join our community! Errandy connects you with trusted service providers in your area.</p>

      <div style="margin: 20px 0;">
        <div class="feature"><span class="feature-icon">✅</span><span><strong>Post Errands</strong> - Get help with tasks big and small</span></div>
        <div class="feature"><span class="feature-icon">👥</span><span><strong>Trusted Providers</strong> - Connect with verified professionals</span></div>
        <div class="feature"><span class="feature-icon">🔒</span><span><strong>Secure Payments</strong> - Pay safely through the app</span></div>
        <div class="feature"><span class="feature-icon">⭐</span><span><strong>Rate & Review</strong> - Help build a trusted community</span></div>
      </div>

      <p>Ready to get started?</p>
      <a href="https://errandy.com.ng" class="button">Open Errandy</a>

      <p style="margin-top: 30px; color: #666;">If you have any questions, just reply to this email - we're always happy to help!</p>
    </div>
    <div class="footer">
      <p>&copy; ${YEAR} Errandy. All rights reserved.</p>
      <p>Lagos, Nigeria</p>
    </div>
  </div>
</body>
</html>`,
    variables: [
      { key: 'name', type: 'string' as const, fallbackValue: 'there' },
    ],
  },
  {
    name: 'verification-otp',
    subject: 'Your verification code',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
    .container { background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
    .header { text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); }
    .logo { max-width: 150px; height: auto; }
    .content { padding: 30px; }
    .footer { text-align: center; padding: 20px; background-color: #f9fafb; color: #666; font-size: 14px; }
    h1, h2, h3 { color: #1f2937; }
    .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4f46e5; text-align: center; margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px; border: 2px dashed #4f46e5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_URL}" alt="Errandy" class="logo" />
    </div>
    <div class="content">
      <h2>Verify your email</h2>
      <p>Hello,</p>
      <p>To complete your sign in, please use the verification code below:</p>

      <div class="otp-code">{{{otp}}}</div>

      <p>This code will expire in <strong>10 minutes</strong>.</p>
      <p style="color: #666;">If you didn't request this code, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>&copy; ${YEAR} Errandy. All rights reserved.</p>
      <p>Lagos, Nigeria</p>
    </div>
  </div>
</body>
</html>`,
    variables: [
      { key: 'otp', type: 'string' as const, fallbackValue: '000000' },
    ],
  },
  {
    name: 'reset-password-otp',
    subject: 'Reset your password',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
    .container { background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
    .header { text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); }
    .logo { max-width: 150px; height: auto; }
    .content { padding: 30px; }
    .footer { text-align: center; padding: 20px; background-color: #f9fafb; color: #666; font-size: 14px; }
    h1, h2, h3 { color: #1f2937; }
    .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #e53935; text-align: center; margin: 30px 0; padding: 20px; background-color: #ffebee; border-radius: 8px; border: 2px dashed #e53935; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${LOGO_URL}" alt="Errandy" class="logo" />
    </div>
    <div class="content">
      <h2>Reset your password</h2>
      <p>Hello,</p>
      <p>We received a request to reset your password. Use the code below to complete the process:</p>

      <div class="otp-code">{{{otp}}}</div>

      <p>This code will expire in <strong>10 minutes</strong>.</p>
      <p style="color: #666;">If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
    </div>
    <div class="footer">
      <p>&copy; ${YEAR} Errandy. All rights reserved.</p>
      <p>Lagos, Nigeria</p>
    </div>
  </div>
</body>
</html>`,
    variables: [
      { key: 'otp', type: 'string' as const, fallbackValue: '000000' },
    ],
  },
];

async function setupTemplates() {
  console.log('Setting up Resend email templates...\n');

  // Get existing templates
  const { data: existingTemplates } = await resend.templates.list();
  const existingNames = new Set(
    existingTemplates?.data?.map((t) => t.name) || [],
  );

  for (const template of templates) {
    try {
      if (existingNames.has(template.name)) {
        console.log(
          `⏭️  Template "${template.name}" already exists, skipping...`,
        );
        continue;
      }

      const { data, error } = await resend.templates.create({
        name: template.name,
        subject: template.subject,
        html: template.html,
        variables: template.variables,
      });

      if (error) {
        console.error(`❌ Failed to create "${template.name}":`, error.message);
      } else {
        console.log(`✅ Created template "${template.name}" (ID: ${data?.id})`);
      }
    } catch (err: any) {
      console.error(`❌ Error creating "${template.name}":`, err.message);
    }
  }

  console.log('\n✨ Template setup complete!');
  console.log('\nTemplate IDs to use in EmailService:');

  const { data: finalTemplates } = await resend.templates.list();
  finalTemplates?.data?.forEach((t) => {
    console.log(`  - ${t.name}: ${t.id}`);
  });
}

setupTemplates().catch(console.error);
