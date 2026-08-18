import { PrismaClient } from '@prisma/client';

export async function seedMarkets(prisma: PrismaClient) {
  const ngMarket = await prisma.market.upsert({
    where: { countryCode: 'NG' },
    update: {},
    create: {
      countryCode: 'NG',
      currency: 'NGN',
      verificationChargeAmountMinorUnits: 0,
    },
  });

  console.log('✅ Default Market (NG) seeded');
  return { ngMarket };
}
