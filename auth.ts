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
    phoneNumber(),
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
    },
  },
  trustedOrigins: ['errandy://*', "http://localhost:3000"],
});
