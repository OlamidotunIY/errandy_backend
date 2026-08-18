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
import 'dotenv/config';
import { BetterAuthIntegration } from '@module/user';
import { APIError } from 'better-auth/api';
import {
  IpCountryResolver,
  MarketRepository,
  PhoneCountryResolver,
} from '@module';

const client = new PrismaClient();

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
        if (BetterAuthIntegration.instance) {
          await BetterAuthIntegration.instance.sendVerificationEmail({
            user: { email },
            type,
            token: otp,
          });
        } else {
          console.log(`Sending OTP to ${email}`);
        }
      },
    }),
    phoneNumber({
      async sendOTP({ phoneNumber: phone, code }, request) {
        if (BetterAuthIntegration.instance) {
          await BetterAuthIntegration.instance.sendVerificationOTP({
            phoneNumber: phone,
            code,
          });
        } else {
          console.log('Sending OTP to phone:', phone);
        }
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
      create: {
        before: async (user, context) => {
          let countryCode = 'UNKNOWN';
          if (user.phoneNumber) {
            countryCode = PhoneCountryResolver.resolve(
              user.phoneNumber as string,
            );
          } else {
            countryCode = IpCountryResolver.resolve(context);
          }

          const marketRepo = new MarketRepository();
          const market = await marketRepo.findByCountryCode(countryCode);
          if (!market) {
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw new APIError('BAD_REQUEST', {
              message: `Market for country code ${countryCode} is not supported.`,
            });
          }
          return { data: { ...user, marketId: market.id.value } };
        },
        after: async (user) => {
          if (BetterAuthIntegration.instance) {
            await BetterAuthIntegration.instance.handleUserCreated(user);
          }
        },
      },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: ['user', 'admin'],
        required: false,
        defaultValue: 'user',
        input: false,
      },
      marketId: {
        type: 'string',
        required: false,
        input: false,
      },
      activeAddressId: {
        type: 'string',
        required: false,
        input: false,
      },
    },
  },
} satisfies BetterAuthOptions);
