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

  async charge(
    email: string,
    amount: number, // in kobo
    authorizationCode: string,
    idempotencyKey: string,
    metadata?: any,
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/charge_authorization`,
        {
          email,
          amount,
          authorization_code: authorizationCode,
          metadata,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        'Error charging saved authorization',
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

  /**
   * Create a charge via bank transfer
   * Returns bank account details for user to transfer to
   */
  async chargeWithTransfer(
    email: string,
    amount: number, // in kobo
    expiresAt?: Date,
    metadata?: any,
  ): Promise<any> {
    try {
      const payload: any = {
        email,
        amount,
        metadata,
        bank_transfer: {},
      };

      // Set expiry if provided (default is 30 mins from Paystack)
      if (expiresAt) {
        payload.bank_transfer.account_expires_at = expiresAt.toISOString();
      }

      const response = await axios.post(`${this.baseUrl}/charge`, payload, {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error(
        'Error creating bank transfer charge',
        error?.response?.data || error.message,
      );
      throw error;
    }
  }

  /**
   * Create a charge via QR code
   * Returns QR code data for user to scan and pay
   */
  async chargeWithQR(
    email: string,
    amount: number, // in kobo
    metadata?: any,
    provider: string = 'scan-to-pay',
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/charge`,
        {
          email,
          amount,
          currency: 'NGN',
          metadata,
          qr: {
            provider,
          },
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
        'Error creating QR charge',
        error?.response?.data || error.message,
      );
      throw error;
    }
  }
}
