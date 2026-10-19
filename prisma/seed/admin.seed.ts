import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';

async function getAvailableUsername(prisma: PrismaClient, email: string) {
  const baseUsername = `admin-${email.split('@')[0].toLowerCase()}`;
  let username = baseUsername;
  let suffix = 2;

  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${baseUsername}-${suffix}`;
    suffix += 1;
  }

  return username;
}

export async function seedAdmins(prisma: PrismaClient, marketId: string) {
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
      const username = await getAvailableUsername(prisma, email);
      await prisma.user.create({
        data: {
          id: userId,
          name: email.split('@')[0],
          email,
          username,
          displayUsername: username,
          emailVerified: true,
          role: Role.ADMIN,
          marketId,
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
      if (existingAdmin.marketId !== marketId) {
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { marketId },
        });
      }
      console.log(`✅ Admin user ${email} already exists.`);
    }
  }
}
