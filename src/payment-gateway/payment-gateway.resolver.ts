// import { Resolver, Mutation, Args, Query, Float } from '@nestjs/graphql';
// import { UseGuards } from '@nestjs/common';
// import { GqlAuthGuard } from '../auth/guard/graphql-auth.guard';
// import { CurrentUser } from '../auth/decorator/current-user.decorator';
// import { User } from '@prisma/client';
// import { PaymentGatewayService } from './payment-gateway.service';
// import { PaymentInitializationResponse } from './dto/payment-initialization.response';
// import { PaymentMethod } from './entities/payment-method.entity';
// import { PaystackCustomer } from './entities/paystack-customer.entity';
// import {
//   WalletFundingResponse,
//   WalletFundingChannel,
// } from './entities/wallet-funding-response.entity';
//
// @Resolver()
// export class PaymentGatewayResolver {
//   constructor(private readonly paymentGatewayService: PaymentGatewayService) {}
//
//   @Query(() => [PaymentMethod])
//   @UseGuards(GqlAuthGuard)
//   async myPaymentMethods(@CurrentUser() user: User) {
//     return this.paymentGatewayService.getPaymentMethods(user);
//   }
//
//   @Mutation(() => PaymentInitializationResponse)
//   @UseGuards(GqlAuthGuard)
//   async initializePaymentMethod(
//     @CurrentUser() user: User,
//     @Args('provider', { nullable: true, defaultValue: 'paystack' })
//     provider: string,
//   ) {
//     return this.paymentGatewayService.initializeAddPaymentMethod(
//       user,
//       provider,
//     );
//   }
//
//   @Mutation(() => PaymentMethod)
//   @UseGuards(GqlAuthGuard)
//   async verifyAndSavePaymentMethod(
//     @CurrentUser() user: User,
//     @Args('reference') reference: string,
//     @Args('provider', { nullable: true, defaultValue: 'paystack' })
//     provider: string,
//   ) {
//     return this.paymentGatewayService.verifyAndSavePaymentMethod(
//       user,
//       reference,
//       provider,
//     );
//   }
//
//   // ==================== Wallet Funding ====================
//
//   @Mutation(() => WalletFundingResponse)
//   @UseGuards(GqlAuthGuard)
//   async initializeWalletFunding(
//     @CurrentUser() user: User,
//     @Args('amount', { type: () => Float, description: 'Amount in kobo' })
//     amount: number,
//     @Args('channel', {
//       type: () => WalletFundingChannel,
//       description: 'Payment channel: card, transfer, or qr',
//     })
//     channel: WalletFundingChannel,
//   ) {
//     return this.paymentGatewayService.initializeWalletFunding(
//       user,
//       amount,
//       channel,
//     );
//   }
//
//   // ==================== Paystack Customer (Query only - creation handled via events) ====================
//
//   @Query(() => PaystackCustomer, { nullable: true })
//   @UseGuards(GqlAuthGuard)
//   async myPaystackCustomer(@CurrentUser() user: User) {
//     return this.paymentGatewayService.getPaystackCustomer(user.id);
//   }
// }
