import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { MarketTemplateDto } from '../dtos/market-template.dto';
import { UpdateMarketTemplateInput } from '../dtos/update-market-template.input';
import { SendAdminBroadcastInput } from '../dtos/send-admin-broadcast.input';
import { GetMarketTemplateQuery } from '../../application/queries/get-market-template/get-market-template.query';
import { ListMarketTemplatesQuery } from '../../application/queries/list-market-templates/list-market-templates.query';
import { UpdateMarketTemplateCommand } from '../../application/commands/update-market-template/update-market-template.command';
import { SendAdminBroadcastCommand } from '../../application/commands/send-admin-broadcast/send-admin-broadcast.command';

@Resolver()
export class NotificationTemplateResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Query(() => MarketTemplateDto, { name: 'marketTemplate' })
  async getMarketTemplate(
    @Args('marketId') marketId: string,
    @Args('type') type: string,
  ) {
    return this.queryBus.execute(new GetMarketTemplateQuery(marketId, type));
  }

  @Query(() => [MarketTemplateDto], { name: 'marketTemplates' })
  async listMarketTemplates(
    @Args('marketId', { nullable: true }) marketId?: string,
  ) {
    return this.queryBus.execute(new ListMarketTemplatesQuery(marketId));
  }

  @Mutation(() => Boolean, { name: 'updateMarketTemplate' })
  async updateMarketTemplate(@Args('input') input: UpdateMarketTemplateInput) {
    await this.commandBus.execute(
      new UpdateMarketTemplateCommand(
        input.marketId,
        input.type,
        input.subject,
        input.html,
        input.name,
      ),
    );
    return true;
  }

  @Mutation(() => Boolean, { name: 'sendAdminBroadcast' })
  async sendAdminBroadcast(@Args('input') input: SendAdminBroadcastInput) {
    await this.commandBus.execute(
      new SendAdminBroadcastCommand(
        input.adminId,
        input.adminEmail,
        input.subject,
        input.templateId,
        input.targetUserIds,
      ),
    );
    return true;
  }
}
