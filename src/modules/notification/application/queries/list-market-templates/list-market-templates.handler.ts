import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ListMarketTemplatesQuery } from './list-market-templates.query';
import { INotificationTemplateRepository } from '../../../domain';
import { EmailAdapter } from '../../../infrastructure/adapters/email.adapter';

@QueryHandler(ListMarketTemplatesQuery)
export class ListMarketTemplatesHandler implements IQueryHandler<ListMarketTemplatesQuery> {
  constructor(
    private readonly templateRepository: INotificationTemplateRepository,
    private readonly emailAdapter: EmailAdapter,
  ) {}

  async execute(query: ListMarketTemplatesQuery): Promise<any[]> {
    const mappings = await this.templateRepository.findAll(query.marketId);
    
    if (!mappings || mappings.length === 0) {
      return [];
    }

    const templates = await Promise.all(
      mappings.map(async (mapping) => {
        try {
          const template = await this.emailAdapter.getTemplate(mapping.resendTemplateId);
          return {
            ...template,
            type: mapping.type,
            marketId: mapping.marketId,
          };
        } catch (err: any) {
          return null;
        }
      })
    );

    return templates.filter(Boolean);
  }
}
