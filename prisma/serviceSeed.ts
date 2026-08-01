import { PrismaClient } from '@prisma/client';
import { CASUAL_JOB, PROFESSIONS } from '../constants';

const prisma = new PrismaClient();

async function seedCategoryGroup(
  groups: Record<string, string[]>,
  requiredTier: string,
) {
  for (const [parentName, leafNames] of Object.entries(groups)) {
    const parent = await prisma.category.upsert({
      where: { name: parentName },
      update: {},
      create: { name: parentName },
    });

    for (const leafName of leafNames) {
      await prisma.category.upsert({
        where: { name: leafName },
        update: {},
        create: {
          name: leafName,
          parentCategoryId: parent.id,
          requiredTier,
        },
      });
    }
  }
}

async function main() {
  await seedCategoryGroup(CASUAL_JOB, 'COMMUNITY');
  await seedCategoryGroup(PROFESSIONS, 'VERIFIED');
}

main()
  .then(() => console.log('Services seeded successfully!'))
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
