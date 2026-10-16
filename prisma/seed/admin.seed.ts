import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';

export async function seedAdmins(prisma: PrismaClient) {
  console.log('Seeding initial Admin accounts...');
  const adminEmails = ['dotuniyanda@errandy.name.ng', 'admin@errandy.com'];
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'adminpassword123';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  for (const email of adminEmails) {
    const existingAdmin = await prisma.user.findUnique({
      where: { email },
    });

    if (!existingAdmin) {
      const userId = crypto.randomUUID();
      await prisma.user.create({
        data: {
          id: userId,
          name: email.split('@')[0],
          email,
          emailVerified: true,
          role: Role.ADMIN,
          createdAt: new Date(),
          updatedAt: new Date(),
          accounts: {
            create: {
              accountId: email,
              providerId: 'credential',
              password: hashedPassword,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        },
      });
      console.log(`✅ Created Admin user: ${email}`);
    } else {
      console.log(`✅ Admin user ${email} already exists.`);
    }
  }
}
