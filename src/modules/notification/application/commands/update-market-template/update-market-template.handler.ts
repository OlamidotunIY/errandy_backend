import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { v4 as uuidv4 } from 'uuid';
import { UpdateMarketTemplateCommand } from './update-market-template.command';
import {
  INotificationTemplateRepository,
  NotificationTemplate,
} from '../../../domain';
import { EmailAdapter } from '../../../infrastructure/adapters/email.adapter';

@CommandHandler(UpdateMarketTemplateCommand)
export class UpdateMarketTemplateHandler implements ICommandHandler<UpdateMarketTemplateCommand> {
  constructor(
    private readonly templateRepository: INotificationTemplateRepository,
    private readonly emailAdapter: EmailAdapter,
  ) {}

  async execute(command: UpdateMarketTemplateCommand): Promise<void> {
    let mapping = await this.templateRepository.findByMarketAndType(
      command.marketId,
      command.type,
    );

    let resendTemplateExists = false;

    if (mapping) {
      try {
        const resendTemplate = await this.emailAdapter.getTemplate(
          mapping.resendTemplateId,
        );
        if (resendTemplate) {
          resendTemplateExists = true;
        }
      } catch (err) {
        resendTemplateExists = false;
      }
    }

    if (mapping && resendTemplateExists) {
      await this.emailAdapter.updateTemplate(mapping.resendTemplateId, {
        name: command.name || `${command.type} (${command.marketId})`,
        subject: command.subject,
        html: command.html,
      });
    } else {
      const created = await this.emailAdapter.createTemplate({
        name: command.name || `${command.type} (${command.marketId})`,
        subject: command.subject,
        html: command.html,
      });

      if (!mapping) {
        mapping = NotificationTemplate.create(
          command.marketId,
          command.type,
          created.id,
          uuidv4(),
        );
      } else {
        mapping.updateResendTemplateId(created.id);
      }

      await this.templateRepository.save(mapping);
    }
  }
}
