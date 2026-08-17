import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SendAdminBroadcastCommand } from './send-admin-broadcast.command';
import { EmailAdapter } from '../../../infrastructure/adapters/email.adapter';
import { PrismaClient } from '@prisma/client';
import { UnauthorizedException } from '@nestjs/common';

@CommandHandler(SendAdminBroadcastCommand)
export class SendAdminBroadcastHandler implements ICommandHandler<SendAdminBroadcastCommand> {
  private prisma = new PrismaClient(); // Simplification: in a real app this should be injected

  constructor(private readonly emailAdapter: EmailAdapter) {}

  async execute(command: SendAdminBroadcastCommand): Promise<void> {
    // 1. Verify admin email domain
    if (!command.adminEmail.endsWith('@errandy.name.ng')) {
      throw new UnauthorizedException('Admin broadcast sender must use an @errandy.name.ng email address.');
    }

    // 2. Fetch target emails
    let users: Array<{ email: string; name: string | null }> = [];
    if (command.targetUserIds && command.targetUserIds.length > 0) {
      users = await this.prisma.user.findMany({
        where: { id: { in: command.targetUserIds } },
        select: { email: true, name: true },
      });
    } else {
      // Broadcast to all
      users = await this.prisma.user.findMany({
        select: { email: true, name: true },
      });
    }

    if (users.length === 0) {
      return;
    }

    // 3. Prepare payload for batch sending
    const payloads = users.map((user) => ({
      from: `Errandy <${command.adminEmail}>`,
      to: [user.email],
      subject: command.subject,
      template: command.templateId,
      context: {
        ...command.context,
        userName: user.name,
      },
    }));

    // 4. Send via batch
    await this.emailAdapter.sendBatch(payloads);
  }
}
