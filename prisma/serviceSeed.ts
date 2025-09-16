import { PrismaClient, ServiceCategoryType } from '@prisma/client';
import { CASUAL_JOB, PROFESSIONS } from '../constants';

const prisma = new PrismaClient();

async function main() {
  // CASUAL jobs
  for (const [categoryName, services] of Object.entries(CASUAL_JOB)) {
    const category = await prisma.serviceCategory.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName, type: ServiceCategoryType.CASUAL },
    });

    for (const serviceName of services) {
      await prisma.service.upsert({
        where: { name: serviceName },
        update: {},
        create: {
          name: serviceName,
          type: ServiceCategoryType.CASUAL,
          categoryId: category.id,
        },
      });
    }
  }

  // PROFESSIONS
  for (const [categoryName, services] of Object.entries(PROFESSIONS)) {
    const category = await prisma.serviceCategory.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName, type: ServiceCategoryType.PROFESSIONAL },
    });

    for (const serviceName of services) {
      await prisma.service.upsert({
        where: { name: serviceName },
        update: {},
        create: {
          name: serviceName,
          type: ServiceCategoryType.PROFESSIONAL,
          categoryId: category.id,
        },
      });
    }
  }
}

main()
  .then(() => console.log('Services seeded successfully!'))
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
