import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Paystack } from '@paystack/paystack-sdk';
import { PAYMENT_PROVIDER } from './payment-provider.constants';

/**
 * Global module that provides a single, shared Paystack SDK instance.
 *
 * Import this module once in `AppModule` — because it is `@Global()`, every
 * other module can inject `@Inject(PAYMENT_PROVIDER)` without adding an
 * explicit import.
 *
 * When we add a second provider (Stripe, Flutterwave, etc.) the factory below
 * is the only place that needs to change — all consumers are already decoupled
 * via the injection token.
 */
@Global()
@Module({
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (config: ConfigService) => {
        return new Paystack(config.getOrThrow<string>('PAYSTACK_SECRET_KEY'));
      },
      inject: [ConfigService],
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentProviderModule {}
