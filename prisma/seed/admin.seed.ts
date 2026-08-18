import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export async function seedAdmins(prisma: PrismaClient) {
  console.log('Seeding initial Admin accounts...');
  const adminEmails = ['dotuniyanda@errandy.name.ng'];
  const defaultPassword = 'adminpassword123'; // Securely change this later
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  for (const email of adminEmails) {
    const existingAdmin = await prisma.user.findUnique({
      where: { email },
    });

    if (!existingAdmin) {
      const userId = uuidv4();
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
