import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetMarketTemplateQuery } from './get-market-template.query';
import { INotificationTemplateRepository } from '../../../domain';
import { EmailAdapter } from '../../../infrastructure/adapters/email.adapter';
import { NotFoundException } from '@nestjs/common';

@QueryHandler(GetMarketTemplateQuery)
export class GetMarketTemplateHandler implements IQueryHandler<GetMarketTemplateQuery> {
  constructor(
    private readonly templateRepository: INotificationTemplateRepository,
    private readonly emailAdapter: EmailAdapter,
  ) {}

  async execute(query: GetMarketTemplateQuery): Promise<any> {
    const mapping = await this.templateRepository.findByMarketAndType(
      query.marketId,
      query.type,
    );

    if (!mapping) {
      throw new NotFoundException(
        `Template mapping for market ${query.marketId} and type ${query.type} not found`,
      );
    }

    try {
      const template = await this.emailAdapter.getTemplate(
        mapping.resendTemplateId,
      );
      return template;
    } catch (err: any) {
      throw new NotFoundException(
        `Template not found on Resend: ${err.message}`,
      );
    }
  }
}
