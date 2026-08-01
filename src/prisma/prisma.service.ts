import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

function isUniqueConstraintViolation(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes(field)
  );
}

function isTransientTransactionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'errorLabels' in error &&
    Array.isArray(error.errorLabels) &&
    error.errorLabels.includes('TransientTransactionError')
  );
}

export { isUniqueConstraintViolation, isTransientTransactionError };
