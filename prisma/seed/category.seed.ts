import { PrismaClient } from '@prisma/client';
import { CASUAL_JOB, PROFESSIONS } from '../../constants';

export async function seedCategories(prisma: PrismaClient) {
  console.log('Seeding initial Nigerian service and errand categories...');

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
          update: {
            parentCategoryId: parent.id,
            requiredTier,
          },
          create: {
            name: leafName,
            parentCategoryId: parent.id,
            requiredTier,
          },
        });
      }
    }
  }

  // Casual jobs (Community tier)
  await seedCategoryGroup(CASUAL_JOB, 'COMMUNITY');
  // Professional jobs (Verified tier)
  await seedCategoryGroup(PROFESSIONS, 'VERIFIED');

  console.log('✅ Categories seeded successfully');
}
