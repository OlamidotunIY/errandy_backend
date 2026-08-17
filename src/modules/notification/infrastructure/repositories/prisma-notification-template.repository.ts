import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  INotificationTemplateRepository,
  NotificationTemplate,
  NotificationTemplateId,
} from '../../domain';

@Injectable()
export class PrismaNotificationTemplateRepository implements INotificationTemplateRepository {
  private readonly prisma = new PrismaClient();

  async findByMarketAndType(
    marketId: string,
    type: string,
  ): Promise<NotificationTemplate | null> {
    const record = await this.prisma.notificationTemplate.findUnique({
      where: { marketId_type: { marketId, type } },
    });

    if (!record) return null;

    return NotificationTemplate.reconstitute({
      id: NotificationTemplateId.create(record.id),
      marketId: record.marketId,
      type: record.type,
      resendTemplateId: record.resendTemplateId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async findAll(marketId?: string): Promise<NotificationTemplate[]> {
    const records = await this.prisma.notificationTemplate.findMany({
      where: marketId ? { marketId } : undefined,
    });

    return records.map((record) =>
      NotificationTemplate.reconstitute({
        id: NotificationTemplateId.create(record.id),
        marketId: record.marketId,
        type: record.type,
        resendTemplateId: record.resendTemplateId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }),
    );
  }

  async save(template: NotificationTemplate): Promise<void> {
    await this.prisma.notificationTemplate.upsert({
      where: {
        id: template.id.value,
      },
      update: {
        resendTemplateId: template.resendTemplateId,
        updatedAt: template.updatedAt,
      },
      create: {
        id: template.id.value,
        marketId: template.marketId,
        type: template.type,
        resendTemplateId: template.resendTemplateId,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.notificationTemplate.delete({
      where: { id },
    });
  }
}
