import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as crypto from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { ILogger } from '@src/common';
import { PAYMENT_PROVIDER } from '@src/infrastructure/payment-provider';
import { PaymentWebhookController } from '@module/payments/presentation';
import {
  IPaymentTransactionRepository,
  PaymentTransaction,
  PaymentTransactionId,
  PaymentMethodId,
  PaymentStatus,
  GatewayReference,
} from '@module/payments/domain';
import {
  Wallet,
  WalletId,
  LedgerEntryType,
} from '@module/wallet/domain';
import {
  LedgerEntryRepository,
  WalletRepository,
  WalletBalanceRepository,
  IBankAccountRepository,
} from '@module/wallet/domain/repositories';
import {
  PayoutDistributionProcessor,
  ReverseWithdrawalCommandHandler,
  OnTransferFailedHandler,
} from '@module/wallet/application';
import { UserId } from '@module/user/domain';
import { PartyId } from '@module/party/domain';
import { ErrandId } from '@module/errands/domain';
import { Money } from '@module/escrow/domain';

describe('Errand Lifecycle, Payment & Payout E2E Integration Suite', () => {
  let app: INestApplication;
  const SECRET_KEY = 'test_paystack_secret_key_mock_12345';
  let mockPaystack: any;
  let mockTransactionRepo: Partial<IPaymentTransactionRepository>;
  let mockBankAccountRepo: Partial<IBankAccountRepository>;
  let mockLedgerRepo: Partial<LedgerEntryRepository>;
  let mockWalletRepo: Partial<WalletRepository>;
  let mockWalletBalanceRepo: Partial<WalletBalanceRepository>;
  let payoutProcessor: PayoutDistributionProcessor;

  // In-memory test state
  const testUserId = UserId.fromString('test-runner-user-uuid');
  const testWalletId = new WalletId('test-runner-wallet-uuid');
  const bankAccountId = 'bank-acc-uuid-1';
  let inMemoryLedger: any[] = [];
  let availableBalance = 1500000; // 15,000.00 NGN in minor units

  beforeAll(async () => {
    mockPaystack = {
      transaction: {
        verify: jest.fn().mockResolvedValue({ status: true, data: { status: 'success' } }),
      },
      transferrecipient: {
        create: jest.fn().mockResolvedValue({
          status: true,
          data: { recipient_code: 'RCP_test_mock_code_123' },
        }),
      },
      transfer: {
        initiate: jest.fn().mockResolvedValue({
          status: true,
          data: { transfer_code: 'TRF_test_mock_code_456', status: 'success' },
        }),
      },
    };

    mockTransactionRepo = {
      findByGatewayReference: jest.fn().mockImplementation((ref: string) => {
        return Promise.resolve(
          PaymentTransaction.reconstitute({
            id: PaymentTransactionId.fromString('tx-1'),
            clientPartyId: new PartyId('party-1'),
            purposeId: new ErrandId('errand-1'),
            amount: Money.fromMinorUnits(1500000, 'NGN'),
            status: PaymentStatus.PENDING,
            gatewayReference: GatewayReference.create(ref),
            method: PaymentMethodId.fromString('pm-1'),
            failureReason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        );
      }),
      save: jest.fn().mockResolvedValue(undefined),
    };

    mockBankAccountRepo = {
      findById: jest.fn().mockResolvedValue({
        id: bankAccountId,
        ownerId: testUserId.value,
        currency: 'NGN',
        bankCode: '058',
        accountNumber: '0123456789',
        accountName: 'John Errandy Runner',
        isVerified: true,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };

    const mockWallet = Wallet.reconstitute(
      testWalletId,
      testUserId,
      'NGN',
      new Date(),
      new Date(),
    );

    mockWalletRepo = {
      findById: jest.fn().mockResolvedValue(mockWallet),
      findByUserId: jest.fn().mockResolvedValue(mockWallet),
    };

    mockLedgerRepo = {
      append: jest.fn().mockImplementation((entry: any) => {
        entry.assignSequence(inMemoryLedger.length + 1);
        inMemoryLedger.push(entry);
        return Promise.resolve([entry]);
      }),
      findByGatewayReference: jest.fn().mockImplementation((ref: string) => {
        return Promise.resolve(
          inMemoryLedger.filter((e) => e.gatewayReference === ref),
        );
      }),
    };

    mockWalletBalanceRepo = {
      getSnapshotForDisplay: jest.fn().mockImplementation(() => ({
        activeMinorUnits: 0,
        pendingMinorUnits: 0,
        availableMinorUnits: availableBalance,
        currency: 'NGN',
      })),
      apply: jest.fn().mockImplementation((walletId: any, entries: any[]) => {
        for (const entry of entries) {
          if (entry.type === LedgerEntryType.AVAILABLE_CREDIT) {
            availableBalance += entry.toMinorUnits();
          } else if (entry.type === LedgerEntryType.WITHDRAWAL_DEBIT) {
            availableBalance -= entry.toMinorUnits();
          }
        }
        return Promise.resolve();
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [CqrsModule],
      controllers: [PaymentWebhookController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'PAYSTACK_SECRET_KEY') return SECRET_KEY;
              return null;
            }),
          },
        },
        {
          provide: ILogger,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
        {
          provide: PAYMENT_PROVIDER,
          useValue: mockPaystack,
        },
        {
          provide: IPaymentTransactionRepository,
          useValue: mockTransactionRepo,
        },
        {
          provide: IBankAccountRepository,
          useValue: mockBankAccountRepo,
        },
        {
          provide: LedgerEntryRepository,
          useValue: mockLedgerRepo,
        },
        {
          provide: WalletRepository,
          useValue: mockWalletRepo,
        },
        {
          provide: WalletBalanceRepository,
          useValue: mockWalletBalanceRepo,
        },
        ReverseWithdrawalCommandHandler,
        OnTransferFailedHandler,
        PayoutDistributionProcessor,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    payoutProcessor = moduleRef.get(PayoutDistributionProcessor);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Flow 1: Paystack Webhook Ingestion & Signature Verification', () => {
    it('should reject webhook requests without a valid HMAC signature', async () => {
      const payload = { event: 'charge.success', data: { reference: 'ref_123' } };

      await request(app.getHttpServer())
        .post('/webhooks/payment-gateway')
        .send(payload)
        .expect(401);
    });

    it('should reject webhook requests with a forged signature', async () => {
      const payload = { event: 'charge.success', data: { reference: 'ref_123' } };

      await request(app.getHttpServer())
        .post('/webhooks/payment-gateway')
        .set('x-paystack-signature', 'forged_tampered_signature_hex')
        .send(payload)
        .expect(401);
    });

    it('should verify genuine HMAC-SHA512 signature and transition transaction to succeeded', async () => {
      const payload = {
        event: 'charge.success',
        data: {
          reference: 'pay_tx_valid_ref_001',
          amount: 1500000,
          currency: 'NGN',
          status: 'success',
        },
      };

      const payloadStr = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha512', SECRET_KEY)
        .update(payloadStr)
        .digest('hex');

      const res = await request(app.getHttpServer())
        .post('/webhooks/payment-gateway')
        .set('x-paystack-signature', signature)
        .send(payload)
        .expect(200);

      expect(res.body).toEqual({ status: 'success' });
      expect(mockTransactionRepo.save).toHaveBeenCalled();
    });
  });

  describe('Flow 2: Automated Payout Transfer Execution', () => {
    const withdrawalRef = 'wd_test_runner_payout_99';

    it('should call Paystack Transfers API to create recipient and initiate transfer', async () => {
      // Simulate withdrawal debit
      const debitEntry = {
        walletId: testWalletId,
        userId: testUserId,
        type: LedgerEntryType.WITHDRAWAL_DEBIT,
        amount: Money.fromMinorUnits(500000, 'NGN'),
        gatewayReference: withdrawalRef,
        idempotencyKey: `WITHDRAWAL_DEBIT_${withdrawalRef}`,
        toMinorUnits: () => 500000,
        assignSequence: (s: number) => { debitEntry.sequence = s; },
        sequence: 1,
      };
      inMemoryLedger.push(debitEntry);
      availableBalance -= 500000;

      // Process payout job
      const jobData = {
        userId: testUserId.value,
        bankAccountId,
        amountMinorUnits: 500000,
        currency: 'NGN',
        gatewayReference: withdrawalRef,
        correlationId: 'corr_test_001',
      };

      const result = await payoutProcessor.process({ data: jobData } as any);

      expect(mockPaystack.transferrecipient.create).toHaveBeenCalledWith({
        type: 'nuban',
        name: 'John Errandy Runner',
        account_number: '0123456789',
        bank_code: '058',
        currency: 'NGN',
      });

      expect(mockPaystack.transfer.initiate).toHaveBeenCalledWith({
        source: 'balance',
        amount: 500000,
        recipient: 'RCP_test_mock_code_123',
        reason: `Errandy Payout ${withdrawalRef}`,
        currency: 'NGN',
        reference: withdrawalRef,
      });

      expect(result).toBeDefined();
    });

    it('should handle transfer.success webhook from Paystack', async () => {
      const payload = {
        event: 'transfer.success',
        data: {
          reference: withdrawalRef,
          amount: 500000,
          currency: 'NGN',
        },
      };

      const payloadStr = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha512', SECRET_KEY)
        .update(payloadStr)
        .digest('hex');

      await request(app.getHttpServer())
        .post('/webhooks/payment-gateway')
        .set('x-paystack-signature', signature)
        .send(payload)
        .expect(200);
    });
  });

  describe('Flow 3: Transfer Failure & Automated Wallet Ledger Reversal', () => {
    it('should automatically reverse debited funds if a transfer fails or is reversed', async () => {
      const failedRef = 'wd_failed_transfer_ref_888';
      const balanceBefore = availableBalance;

      // Runner requested 3,000 NGN withdrawal
      const failedDebitEntry = {
        walletId: testWalletId,
        userId: testUserId,
        type: LedgerEntryType.WITHDRAWAL_DEBIT,
        amount: Money.fromMinorUnits(300000, 'NGN'),
        gatewayReference: failedRef,
        idempotencyKey: `WITHDRAWAL_DEBIT_${failedRef}`,
        toMinorUnits: () => 300000,
        assignSequence: (s: number) => { failedDebitEntry.sequence = s; },
        sequence: inMemoryLedger.length + 1,
      };
      inMemoryLedger.push(failedDebitEntry);
      availableBalance -= 300000;

      expect(availableBalance).toBe(balanceBefore - 300000);

      // Webhook delivers transfer.failed event
      const payload = {
        event: 'transfer.failed',
        data: {
          reference: failedRef,
          amount: 300000,
          reason: 'Destination account is frozen or closed',
        },
      };

      const payloadStr = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha512', SECRET_KEY)
        .update(payloadStr)
        .digest('hex');

      await request(app.getHttpServer())
        .post('/webhooks/payment-gateway')
        .set('x-paystack-signature', signature)
        .send(payload)
        .expect(200);

      // Verify that available balance was restored via reverse withdrawal
      expect(availableBalance).toBe(balanceBefore);

      // Verify that a reversal AVAILABLE_CREDIT entry exists in the ledger
      const reversalEntry = inMemoryLedger.find(
        (e) =>
          e.type === LedgerEntryType.AVAILABLE_CREDIT &&
          e.idempotencyKey.includes(`reversal_${failedRef}`),
      );
      expect(reversalEntry).toBeDefined();
    });
  });
});
