import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create 2dsphere index for Errand collection
  await prisma.$runCommandRaw({
    createIndexes: 'errand', // collection name in MongoDB
    indexes: [
      {
        key: { location: '2dsphere' },
        name: 'location_2dsphere'
      }
    ]
  });
  console.log('✅ 2dsphere index created for Errand collection');

  // Create 2dsphere index for UserAddress collection
  await prisma.$runCommandRaw({
    createIndexes: 'userAddress', // collection name in MongoDB
    indexes: [
      {
        key: { location: '2dsphere' },
        name: 'location_2dsphere'
      }
    ]
  });
  console.log('✅ 2dsphere index created for UserAddress collection');
}

main()
  .then(() => {
    console.log('🎯 Index setup complete');
    prisma.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
