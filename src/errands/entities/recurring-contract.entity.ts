import { ObjectType, Field, ID } from '@nestjs/graphql';
import { RecurrenceFrequency } from './recurrence-frequency.enum';
import { ErrandTemplate } from './errand-template.entity';

@ObjectType()
export class RecurringContract {
  @Field(() => ID)
  id: string;

  @Field()
  clientId: string;

  @Field()
  providerOrgId: string;

  @Field()
  templateId: string;

  @Field(() => RecurrenceFrequency)
  frequency: RecurrenceFrequency;

  @Field()
  nextRunAt: Date;

  @Field()
  active: boolean;

  @Field()
  providerPreAccepted: boolean;

  @Field({ nullable: true })
  acceptedAt?: Date;

  @Field(() => ErrandTemplate)
  template: ErrandTemplate;
}
