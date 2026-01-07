import { ObjectType, Field, ID } from '@nestjs/graphql';
import { RecurrenceFrequency } from './recurrence-frequency.enum';
import Client from 'src/client/entities/client.entities';
import { ErrandTemplate } from './errand-template.entity';

@ObjectType()
export class RecurringErrand {
  @Field(() => ID)
  id: string;

  @Field()
  clientId: string;

  @Field()
  templateId: string;

  @Field(() => RecurrenceFrequency)
  frequency: RecurrenceFrequency;

  @Field()
  nextRunAt: Date;

  @Field()
  active: boolean;

  @Field(() => Client, { nullable: true })
  client?: Client;

  @Field(() => ErrandTemplate, { nullable: true })
  template?: ErrandTemplate;
}
