import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

import { seedIndexes } from './seed/indexes.seed';
import { seedMarkets } from './seed/market.seed';
import { seedTemplates } from './seed/templates.seed';
import { seedAdmins } from './seed/admin.seed';

const prisma = new PrismaClient();

async function main() {
  await seedIndexes(prisma);
  const { ngMarket } = await seedMarkets(prisma);
  await seedAdmins(prisma);
  await seedTemplates(prisma, ngMarket.id);
}

main()
  .then(() => {
    console.log('🎯 Seeding complete');
    prisma.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
