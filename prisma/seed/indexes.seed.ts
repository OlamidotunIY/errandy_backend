import { PrismaClient } from '@prisma/client';

export async function seedIndexes(prisma: PrismaClient) {
  // Create 2dsphere index for Errand collection
  await prisma.$runCommandRaw({
    createIndexes: 'errands', // collection name in MongoDB
    indexes: [
      {
        key: { location: '2dsphere' },
        name: 'location_2dsphere',
      },
    ],
  });
  console.log('✅ 2dsphere index created for Errand collection');

  // Create 2dsphere index for UserAddress collection
  await prisma.$runCommandRaw({
    createIndexes: 'user_addresses', // collection name in MongoDB
    indexes: [
      {
        key: { location: '2dsphere' },
        name: 'location_2dsphere',
      },
    ],
  });
  console.log('✅ 2dsphere index created for UserAddress collection');
}
