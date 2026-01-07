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

  /**
   * Create a Paystack customer
   */
  async createCustomer(
    email: string,
    firstName?: string,
    lastName?: string,
    phone?: string,
    metadata?: any,
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/customer`,
        {
          email,
          first_name: firstName,
          last_name: lastName,
          phone,
          metadata,
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
        'Error creating Paystack customer',
        error?.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Update a Paystack customer by customer code
   */
  async updateCustomer(
    customerCode: string,
    updates: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      metadata?: any;
    },
  ): Promise<any> {
    try {
      const response = await axios.put(
        `${this.baseUrl}/customer/${customerCode}`,
        {
          first_name: updates.firstName,
          last_name: updates.lastName,
          phone: updates.phone,
          metadata: updates.metadata,
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
        `Error updating Paystack customer: ${customerCode}`,
        error?.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Fetch a Paystack customer by customer code
   */
  async fetchCustomer(customerCode: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/customer/${customerCode}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Error fetching Paystack customer: ${customerCode}`,
        error?.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Create a dedicated virtual account for a customer
   * Returns a NUBAN that can receive transfers
   */
  async createDedicatedAccount(
    customerIdOrCode: string,
    preferredBank: string = 'wema-bank',
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/dedicated_account`,
        {
          customer: customerIdOrCode,
          preferred_bank: preferredBank,
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
        `Error creating dedicated account for customer: ${customerIdOrCode}`,
        error?.response?.data || error.message,
      );
      throw error;
    }
  }
}
