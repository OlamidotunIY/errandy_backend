import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';
import {
  twoFactor,
  username,
  phoneNumber,
  emailOTP,
} from 'better-auth/plugins';
import { betterAuth, BetterAuthOptions } from 'better-auth';
import { expo } from '@better-auth/expo';
import { sendOTP } from './src/utils/otp.utils';
import { globalEventEmitter } from './src/utils/event-emitter.utils';
import 'dotenv/config';

const client = new PrismaClient();

import { EmailService } from './src/email/email.service';

const emailService = new EmailService();

export const auth = betterAuth({
  database: prismaAdapter(client, {
    provider: 'mongodb',
  }),
  appName: 'errandy_backend',
  plugins: [
    expo(),
    emailOTP({
      overrideDefaultEmailVerification: true,
      sendVerificationOnSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        if (type === 'email-verification') {
          console.log(`Sending OTP to ${email}`);
          await emailService.sendEmail(
            {
              to: email,
              subject: 'Verify your email',
              template: 'verification-otp',
              context: { otp },
            },
            'transactional',
          );
        } else {
          console.log(`Sending OTP to ${email}`);
          await emailService.sendEmail(
            {
              to: email,
              subject: 'Reset your password',
              template: 'reset-password-otp',
              context: { otp },
            },
            'transactional',
          );
        }
      },
    }),
    phoneNumber({
      async sendOTP({ phoneNumber: phone, code }, request) {
        console.log('Sending OTP to phone:', phone);

        // Format phone number (remove any non-digit characters except +)
        let formattedPhone = phone.replace(/[^\d+]/g, '');

        // Ensure +234 prefix if missing
        if (!formattedPhone.startsWith('+')) {
          // Remove leading 0 if present (e.g., 081... -> 81...)
          if (formattedPhone.startsWith('0')) {
            formattedPhone = formattedPhone.substring(1);
          }
          formattedPhone = '+234' + formattedPhone;
        }

        // Twilio generates its own OTP code
        await sendOTP(formattedPhone, code);
      },
    }),
    username({
      minUsernameLength: 5,
    }),
    twoFactor(),
  ],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      mapProfileToUser: (profile) => {
        return {
          username:
            profile.email.split('@')[0] +
            Math.random().toString(36).slice(2, 7),
        };
      },
    },
  },
  trustedOrigins: [
    'errandy://*',
    'errandy:///',
    'http://localhost:3000',
    'exp://*',
    'https://errandy-backend.onrender.com',
  ],
  hooks: {},
  databaseHooks: {
    user: {
      // create: {
      //   after: async (user) => {
      //     // This fires ONLY when a new user is created (email, Google, Apple, etc.)
      //     // NOT when an existing user signs in
      //     await globalEventEmitter.emit('user.created', {
      //       userId: user.id,
      //       email: user.email,
      //       firstName: user.name?.split(' ')[0],
      //       lastName: user.name?.split(' ').slice(1).join(' '),
      //       phone: user.phoneNumber,
      //     });
      //   },
      // },
      // update: {
      //   after: async (user) => {
      //     console.log('User update database hook triggered');
      //     console.log('User ID:', user.id);
      //     console.log('Phone:', user.phoneNumber);
      //     console.log('Phone Verified:', user.phoneNumberVerified);
      //
      //     // Emit user.updated event when phone is set/verified
      //     if (user.phoneNumber && user.phoneNumberVerified) {
      //       console.log('Emitting user.updated from database hook');
      //       globalEventEmitter.emit('user.updated', {
      //         userId: user.id,
      //         firstName: user.name?.split(' ')[0],
      //         lastName: user.name?.split(' ').slice(1).join(' '),
      //         phone: user.phoneNumber,
      //       });
      //     }
      //   },
      // },
    },
  },
} satisfies BetterAuthOptions);
