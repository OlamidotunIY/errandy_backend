import { ObjectType, Field, Float } from '@nestjs/graphql';
import { ErrandStatus } from './errandStatus.enum';
import { WorkerType } from './workerType.enum';
import { PricingType } from './pricingType.enum';
import Client from 'src/client/entities/client.entities';
import { Service } from 'src/service/entities/service.entity';

@ObjectType()
export class Errand {
  @Field()
  id: string;

  @Field()
  clientId: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => PricingType)
  pricingType: PricingType;

  @Field(() => Float, { nullable: true })
  price?: number;

  @Field(() => Float, { nullable: true })
  hourlyRate?: number;

  @Field(() => ErrandStatus)
  status: ErrandStatus;

  @Field(() => WorkerType, { nullable: true })
  workerType?: WorkerType;

  @Field({ nullable: true })
  serviceId?: string;

  @Field(() => Service, { nullable: true })
  service?: Service;

  @Field({ nullable: true })
  assignedTo?: string;

  @Field({ nullable: true })
  applicationDeadline?: Date;

  @Field({ nullable: true })
  completionDeadline?: Date;

  @Field({ nullable: true })
  serviceAddress?: string;

  @Field(() => Float, { nullable: true })
  latitude?: number;

  @Field(() => Float, { nullable: true })
  longitude?: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => Client)
  client: Client;
}
