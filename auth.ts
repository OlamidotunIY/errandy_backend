import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';
import {
  twoFactor,
  username,
  phoneNumber,
  emailOTP,
} from 'better-auth/plugins';
import { betterAuth } from 'better-auth';
import { expo } from '@better-auth/expo';
import { sendOTP } from './src/utils/otp.utils';
import { globalEventEmitter } from './src/utils/event-emitter.utils';

const client = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(client, {
    provider: 'mongodb',
  }),
  appName: 'errandy_backend',
  plugins: [
    expo(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }, request) {
        console.log('email', email);
        console.log('otp', otp);
        console.log('type', type);
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
      callbackOnVerification({ phoneNumber, user }, ctx) {
        // Emit user.updated event when phone is verified
        globalEventEmitter.emit('user.updated', {
          userId: user.id,
          phone: phoneNumber,
        });
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
      mapProfileToUser: async (profile) => {
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
    'http://localhost:3000',
    'exp://*',
    'exp://172.19.130.114:8081',
  ],
  hooks: {},
});
