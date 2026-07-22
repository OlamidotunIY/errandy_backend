import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { AcceptApplicationInput } from 'src/application/dto/accept-application.input';
import { ApplicationStatus } from 'src/application/entities/applicationStatus.enum';
import { ErrandStatus } from 'src/errands/entities/errandStatus.enum';
import { PaymentGatewayService } from 'src/payment-gateway/payment-gateway.service';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);
  private static readonly HOLD_PERIOD_DAYS = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentGatewayService: PaymentGatewayService,
  ) {}

  private toKobo(amountNaira: number): number {
    if (!Number.isFinite(amountNaira)) {
      return 0;
    }
    return Math.round(amountNaira * 100);
  }

  private calculateAmountGrossKobo(errand: any): number {
    const baseNaira = errand?.price ?? errand?.hourlyRate ?? 0;
    const transportNaira = errand?.transportAllowance ?? 0;
    const materialsNaira = errand?.materialsBudget ?? 0;

    return (
      this.toKobo(baseNaira) +
      this.toKobo(transportNaira) +
      this.toKobo(materialsNaira)
    );
  }

  private calculatePlatformFeeKobo(amountGrossKobo: number): number {
    const feeBps = Number(process.env.ESCROW_PLATFORM_FEE_BPS ?? 0);
    if (!Number.isFinite(feeBps) || feeBps <= 0) {
      return 0;
    }

    // basis points: fee = gross * (bps/10000)
    return Math.round((amountGrossKobo * feeBps) / 10000);
  }

  private errandIncludeForGraphQL() {
    return {
      service: true,
      ratings: true,
      client: {
        include: {
          user: true,
          paymentMethods: true,
        },
      },
    };
  }

  /**
   * Accept an application and create escrow after charging the client.
   *
   * Idempotency & concurrency:
   * - Payment is charged with gateway idempotency key: CHARGE_ERRAND_ACCEPT:<errandId>
   * - Escrow has unique(errandId) => one escrow per errand
   * - Ledger "hold" has unique reference: ESCROW_HOLD:<errandId>
   */
  async acceptApplicationAndFundEscrow(
    input: AcceptApplicationInput,
    userId: string,
  ) {
    const application = await this.prisma.application.findUnique({
      where: { id: input.applicationId },
    });

    if (!application) {
      throw new BadRequestException('Application not found');
    }

    const errand = await this.prisma.errand.findUnique({
      where: { id: application.errandId },
      include: { client: true },
    });

    if (!errand) {
      throw new BadRequestException('Errand not found');
    }

    const client = await this.prisma.client.findUnique({
      where: { userId },
    });

    if (!client || client.id !== errand.clientId) {
      throw new BadRequestException(
        'Not authorized to accept this application',
      );
    }

    const existingEscrow = await this.prisma.escrow.findUnique({
      where: { errandId: errand.id },
    });

    if (existingEscrow) {
      if (existingEscrow.workerId !== application.workerId) {
        throw new BadRequestException(
          'This errand already has an accepted application',
        );
      }

      // Best-effort idempotent healing for clients that retry after a successful accept.
      await this.prisma.$transaction(async (tx) => {
        const acceptedAt = existingEscrow.createdAt ?? new Date();

        await tx.application.updateMany({
          where: { id: application.id },
          data: { status: ApplicationStatus.ACCEPTED, acceptedAt },
        });

        await tx.errand.updateMany({
          where: { id: errand.id },
          data: {
            status: ErrandStatus.IN_PROGRESS,
            assignedTo: application.workerId,
            assignedAt: acceptedAt,
          },
        });

        await tx.application.updateMany({
          where: {
            errandId: errand.id,
            id: { not: application.id },
            status: ApplicationStatus.PENDING,
          },
          data: { status: ApplicationStatus.CANCELLED },
        });

        await tx.transaction.upsert({
          where: { reference: `ESCROW_HOLD:${errand.id}` },
          update: {},
          create: {
            ownerId: client.id,
            ownerType: UserRole.CLIENT,
            errandId: errand.id,
            amount: existingEscrow.amountGross,
            type: 'ESCROW_HOLD',
            status: 'SUCCESS',
            reference: `ESCROW_HOLD:${errand.id}`,
            metadata: {
              paymentRef: existingEscrow.paymentRef,
              currency: existingEscrow.currency,
              platformFeeKobo: existingEscrow.platformFee,
              amountNetWorkerKobo: existingEscrow.amountNetWorker,
              workerId: existingEscrow.workerId,
            },
          },
        });
      });

      return this.prisma.errand.findUnique({
        where: { id: errand.id },
        include: this.errandIncludeForGraphQL(),
      });
    }

    if (application.status !== ApplicationStatus.PENDING) {
      throw new BadRequestException(
        'Only pending applications can be accepted',
      );
    }

    if (errand.status !== ErrandStatus.OPEN) {
      throw new BadRequestException(
        'Only open errands can accept applications',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const paymentMethod = input.paymentMethodId
      ? await this.prisma.paymentMethod.findUnique({
          where: { id: input.paymentMethodId },
        })
      : await this.prisma.paymentMethod.findFirst({
          where: { userId: client.id, verified: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        });

    if (!paymentMethod || paymentMethod.userId !== client.id) {
      throw new BadRequestException('Invalid payment method');
    }

    if (!paymentMethod.verified) {
      throw new BadRequestException('Payment method is not verified');
    }

    const currency = 'NGN';
    const amountGrossKobo = this.calculateAmountGrossKobo(errand);

    if (amountGrossKobo <= 0) {
      throw new BadRequestException('Invalid errand amount');
    }

    const platformFeeKobo = this.calculatePlatformFeeKobo(amountGrossKobo);
    const amountNetWorkerKobo = amountGrossKobo - platformFeeKobo;

    if (amountNetWorkerKobo < 0) {
      throw new BadRequestException('Invalid platform fee configuration');
    }

    const idempotencyKey = `CHARGE_ERRAND_ACCEPT:${errand.id}`;

    const chargeResult =
      await this.paymentGatewayService.chargeSavedPaymentMethod(
        user,
        paymentMethod.id,
        amountGrossKobo,
        idempotencyKey,
        {
          type: 'ERRAND_ESCROW',
          errandId: errand.id,
          applicationId: application.id,
          clientId: client.id,
          workerId: application.workerId,
          currency,
          amountGrossKobo,
        },
      );

    const paymentRef = chargeResult.paymentRef;
    const acceptedAt = new Date();

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Re-check inside transaction for concurrency.
        const escrowNow = await tx.escrow.findUnique({
          where: { errandId: errand.id },
        });

        if (escrowNow) {
          if (escrowNow.workerId !== application.workerId) {
            throw new BadRequestException(
              'This errand already has an accepted application',
            );
          }

          return tx.errand.findUnique({
            where: { id: errand.id },
            include: this.errandIncludeForGraphQL(),
          });
        }

        const appUpdated = await tx.application.updateMany({
          where: { id: application.id, status: ApplicationStatus.PENDING },
          data: { status: ApplicationStatus.ACCEPTED, acceptedAt },
        });

        if (appUpdated.count === 0) {
          throw new BadRequestException(
            'Only pending applications can be accepted',
          );
        }

        const errandUpdated = await tx.errand.updateMany({
          where: { id: errand.id, status: ErrandStatus.OPEN },
          data: {
            status: ErrandStatus.IN_PROGRESS,
            assignedTo: application.workerId,
            assignedAt: acceptedAt,
          },
        });

        if (errandUpdated.count === 0) {
          throw new BadRequestException(
            'Only open errands can accept applications',
          );
        }

        await tx.application.updateMany({
          where: {
            errandId: errand.id,
            id: { not: application.id },
            status: ApplicationStatus.PENDING,
          },
          data: { status: ApplicationStatus.CANCELLED },
        });

        await tx.transaction.upsert({
          where: { reference: `ESCROW_HOLD:${errand.id}` },
          update: {},
          create: {
            ownerId: client.id,
            ownerType: UserRole.CLIENT,
            errandId: errand.id,
            amount: amountGrossKobo,
            type: 'ESCROW_HOLD',
            status: 'SUCCESS',
            reference: `ESCROW_HOLD:${errand.id}`,
            metadata: {
              paymentRef,
              currency,
              platformFeeKobo,
              amountNetWorkerKobo,
              workerId: application.workerId,
              paymentMethodId: paymentMethod.id,
            },
          },
        });

        await tx.escrow.create({
          data: {
            errandId: errand.id,
            clientId: client.id,
            workerId: application.workerId,
            amountGross: amountGrossKobo,
            platformFee: platformFeeKobo,
            amountNetWorker: amountNetWorkerKobo,
            currency,
            paymentRef,
            status: 'FUNDED',
          },
        });

        return tx.errand.findUnique({
          where: { id: errand.id },
          include: this.errandIncludeForGraphQL(),
        });
      });
    } catch (error) {
      // If another request won the race, surface a clear error (or return idempotent success).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const escrowAfter = await this.prisma.escrow.findUnique({
          where: { errandId: errand.id },
        });

        if (escrowAfter && escrowAfter.workerId === application.workerId) {
          return this.prisma.errand.findUnique({
            where: { id: errand.id },
            include: this.errandIncludeForGraphQL(),
          });
        }

        throw new BadRequestException(
          'This errand already has an accepted application',
        );
      }

      throw error;
    }
  }

  /**
   * Called when the assigned provider marks the errand as completed.
   *
   * Idempotency:
   * - Escrow transitions FUNDED -> HELD only once (holdUntil set once)
   * - Wallet.held credited only when that transition occurs
   * - Ledger entry uses unique reference: ESCROW_PENDING_CREDIT:<errandId>
   */
  async markErrandCompleted(errandId: string, userId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
    });
    if (!provider) {
      throw new BadRequestException('User does not have a provider profile');
    }

    const errand = await this.prisma.errand.findUnique({
      where: { id: errandId },
    });
    if (!errand) {
      throw new BadRequestException('Errand not found');
    }

    if (errand.assignedTo !== provider.id) {
      throw new BadRequestException('Not authorized to complete this errand');
    }

    if (
      ![ErrandStatus.IN_PROGRESS, ErrandStatus.COMPLETED].includes(
        errand.status as any,
      )
    ) {
      throw new BadRequestException('Errand is not in a completable state');
    }

    const escrow = await this.prisma.escrow.findUnique({ where: { errandId } });
    if (!escrow) {
      throw new BadRequestException('Escrow not found for this errand');
    }

    if (escrow.workerId !== provider.id) {
      throw new BadRequestException('Escrow worker mismatch');
    }

    const completedAt = new Date();
    const holdUntil = new Date(
      completedAt.getTime() +
        EscrowService.HOLD_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.errand.updateMany({
        where: {
          id: errandId,
          assignedTo: provider.id,
          status: ErrandStatus.IN_PROGRESS,
        },
        data: { status: ErrandStatus.COMPLETED },
      });

      const moved = await tx.escrow.updateMany({
        where: { errandId, status: 'FUNDED' },
        data: { status: 'HELD', holdUntil },
      });

      if (moved.count === 0) {
        return;
      }

      await tx.wallet.upsert({
        where: {
          ownerId_ownerType: {
            ownerId: provider.id,
            ownerType: UserRole.PROVIDER,
          },
        },
        create: {
          ownerId: provider.id,
          ownerType: UserRole.PROVIDER,
          available: 0,
          held: escrow.amountNetWorker,
          currency: escrow.currency,
        },
        update: {
          held: { increment: escrow.amountNetWorker },
          currency: escrow.currency,
        },
      });

      await tx.transaction.upsert({
        where: { reference: `ESCROW_PENDING_CREDIT:${errandId}` },
        update: {},
        create: {
          ownerId: provider.id,
          ownerType: UserRole.PROVIDER,
          errandId,
          amount: escrow.amountNetWorker,
          type: 'ESCROW_PENDING_CREDIT',
          status: 'SUCCESS',
          reference: `ESCROW_PENDING_CREDIT:${errandId}`,
          metadata: {
            stage: 'PENDING_EARNINGS',
            currency: escrow.currency,
            amountGrossKobo: escrow.amountGross,
            platformFeeKobo: escrow.platformFee,
            paymentRef: escrow.paymentRef,
            holdUntil,
          },
        },
      });
    });

    return this.prisma.errand.findUnique({
      where: { id: errandId },
      include: this.errandIncludeForGraphQL(),
    });
  }

  /**
   * Release eligible escrows whose hold has expired.
   *
   * Exactly-once:
   * - Escrow status transition HELD -> RELEASING is conditional (acts as lock)
   * - Ledger uses unique reference: ESCROW_RELEASE:<errandId>
   */
  async releaseEligibleEscrows(limit: number = 50) {
    const now = new Date();

    const eligible = await this.prisma.escrow.findMany({
      where: {
        status: 'HELD',
        holdUntil: { lte: now },
      },
      orderBy: { holdUntil: 'asc' },
      take: limit,
    });

    let released = 0;
    let skipped = 0;

    for (const escrow of eligible) {
      try {
        const didRelease = await this.prisma.$transaction(async (tx) => {
          const locked = await tx.escrow.updateMany({
            where: {
              id: escrow.id,
              status: 'HELD',
              holdUntil: { lte: now },
            },
            data: { status: 'RELEASING' },
          });

          if (locked.count === 0) {
            return false;
          }

          await tx.transaction.create({
            data: {
              ownerId: escrow.workerId,
              ownerType: UserRole.PROVIDER,
              errandId: escrow.errandId,
              amount: escrow.amountNetWorker,
              type: 'ESCROW_RELEASE',
              status: 'SUCCESS',
              reference: `ESCROW_RELEASE:${escrow.errandId}`,
              metadata: {
                currency: escrow.currency,
                amountGrossKobo: escrow.amountGross,
                platformFeeKobo: escrow.platformFee,
                paymentRef: escrow.paymentRef,
              },
            },
          });

          await tx.wallet.upsert({
            where: {
              ownerId_ownerType: {
                ownerId: escrow.workerId,
                ownerType: UserRole.PROVIDER,
              },
            },
            create: {
              ownerId: escrow.workerId,
              ownerType: UserRole.PROVIDER,
              available: escrow.amountNetWorker,
              held: 0,
              currency: escrow.currency,
            },
            update: {
              held: { decrement: escrow.amountNetWorker },
              available: { increment: escrow.amountNetWorker },
              currency: escrow.currency,
            },
          });

          await tx.escrow.update({
            where: { id: escrow.id },
            data: { status: 'RELEASED', releasedAt: now },
          });

          return true;
        });

        if (didRelease) {
          released += 1;
        } else {
          skipped += 1;
        }
      } catch (error) {
        // If another worker already created the release ledger entry, treat as already released.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          await this.prisma.escrow.updateMany({
            where: {
              id: escrow.id,
              status: { in: ['HELD', 'RELEASING'] },
            },
            data: { status: 'RELEASED', releasedAt: now },
          });
          skipped += 1;
          continue;
        }

        this.logger.error(
          `Failed to release escrow for errand ${escrow.errandId}: ${error.message}`,
        );
        throw error;
      }
    }

    return { scanned: eligible.length, released, skipped };
  }
}
