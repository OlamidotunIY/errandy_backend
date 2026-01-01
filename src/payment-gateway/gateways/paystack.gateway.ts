import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PaymentGateway } from '../interfaces/payment-gateway.interface';

@Injectable()
export class PaystackGateway implements PaymentGateway {
  private readonly logger = new Logger(PaystackGateway.name);
  private readonly baseUrl = 'https://api.paystack.co';
  private readonly secretKey = process.env.PAYSTACK_SECRET_KEY;

  async initializeTransaction(
    email: string,
    amount: number, // in kobo
    callbackUrl: string,
    metadata?: any,
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email,
          amount,
          callback_url: callbackUrl,
          metadata,
          channels: ['card'], // User specified "now we only support card"
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        'Error initializing Paystack transaction',
        error?.response?.data || error.message,
      );
      throw error;
    }
  }

  async verifyTransaction(reference: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Error verifying Paystack transaction: ${reference}`,
        error?.response?.data || error.message,
      );
      throw error;
    }
  }

  async refundTransaction(
    transactionOrReference: string,
    amount: number,
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/refund`,
        {
          transaction: transactionOrReference,
          amount,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Error initiating refund for ${transactionOrReference}`,
        error?.response?.data || error.message,
      );
      throw error;
    }
  }

  async retryRefund(refundId: string, accountDetails: any): Promise<any> {
    try {
      // user provided endpoint: /refund/retry_with_customer_details/{id}
      // We replace {id} with refundId or validation error might occur if clean ID not provided
      const url = `${this.baseUrl}/refund/retry_with_customer_details/${refundId}`;

      const response = await axios.post(
        url,
        {
          refund_account_details: accountDetails,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Error retrying refund for ${refundId}`,
        error?.response?.data || error.message,
      );
      throw error;
    }
  }
}
