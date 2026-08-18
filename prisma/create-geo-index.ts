import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createGeospatialIndex() {
  try {
    console.log('Creating 2dsphere index on errands.location...');

    // Create 2dsphere index for geospatial queries
    await prisma.$runCommandRaw({
      createIndexes: 'errands',
      indexes: [
        {
          key: { location: '2dsphere' },
          name: 'location_2dsphere',
        },
      ],
    });

    console.log('✅ Successfully created 2dsphere index on errands.location');
  } catch (error) {
    console.error('❌ Error creating geospatial index:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createGeospatialIndex();
