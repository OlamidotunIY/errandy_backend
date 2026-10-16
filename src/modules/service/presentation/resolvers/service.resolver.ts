import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '@src/common/guards';
import {
  GetServiceByIdQuery,
  SearchServicesQuery,
  ListServiceCommand,
  UpdateServicePriceCommand,
  DeactivateServiceCommand,
  ServiceResponseDto,
} from '../../application';
import {
  ServiceGraphQLType,
  ServiceOperationResultType,
  ListServiceInput,
  UpdateServicePriceInput,
} from '../graphql';

@Resolver(() => ServiceGraphQLType)
export class ServiceResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Query(() => ServiceGraphQLType, {
    name: 'serviceById',
    nullable: true,
    description: 'Get a service listing by its unique identifier',
  })
  async serviceById(
    @Args('id') id: string,
  ): Promise<ServiceResponseDto | null> {
    return this.queryBus.execute(new GetServiceByIdQuery({ serviceId: id }));
  }

  @Query(() => [ServiceGraphQLType], {
    name: 'searchServices',
    description: 'Search active services by category and market',
  })
  async searchServices(
    @Args('marketId') marketId: string,
    @Args('categoryId', { nullable: true }) categoryId?: string,
    @Args('limit', { defaultValue: 20 }) limit = 20,
    @Args('cursor', { nullable: true }) cursor?: string,
  ): Promise<ServiceResponseDto[]> {
    return this.queryBus.execute(
      new SearchServicesQuery({
        marketId,
        categoryId,
        limit,
        cursor,
      }),
    );
  }

  @Mutation(() => ServiceOperationResultType, {
    name: 'listService',
    description: 'List a new provider service in a category',
  })
  @UseGuards(GqlAuthGuard)
  async listService(
    @Args('input') input: ListServiceInput,
  ): Promise<ServiceOperationResultType> {
    return this.commandBus.execute(new ListServiceCommand(input));
  }

  @Mutation(() => ServiceOperationResultType, {
    name: 'updateServicePrice',
    description: 'Update the price of an existing service',
  })
  @UseGuards(GqlAuthGuard)
  async updateServicePrice(
    @Args('input') input: UpdateServicePriceInput,
  ): Promise<ServiceOperationResultType> {
    return this.commandBus.execute(new UpdateServicePriceCommand(input));
  }

  @Mutation(() => ServiceOperationResultType, {
    name: 'deactivateService',
    description: 'Deactivate an active service listing',
  })
  @UseGuards(GqlAuthGuard)
  async deactivateService(
    @Args('serviceId') serviceId: string,
  ): Promise<ServiceOperationResultType> {
    return this.commandBus.execute(
      new DeactivateServiceCommand({ serviceId }),
    );
  }
}
