import { NotificationTemplate } from '../entities/notification-template.entity';

export abstract class INotificationTemplateRepository {
  abstract findByMarketAndType(
    marketId: string,
    type: string,
  ): Promise<NotificationTemplate | null>;
  abstract findAll(marketId?: string): Promise<NotificationTemplate[]>;
  abstract save(template: NotificationTemplate): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
