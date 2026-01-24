/**
 * Release eligible escrows whose hold period has elapsed.
 *
 * Run with:
 *   npx ts-node -r tsconfig-paths/register scripts/release-eligible-escrows.ts
 *
 * In production, compile first and run:
 *   node dist/scripts/release-eligible-escrows.js
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { EscrowService } from '../src/escrow/escrow.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const escrowService = app.get(EscrowService);
    const limit = Number(process.env.ESCROW_RELEASE_LIMIT ?? 50);
    const result = await escrowService.releaseEligibleEscrows(limit);
    // eslint-disable-next-line no-console
    console.log(result);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
