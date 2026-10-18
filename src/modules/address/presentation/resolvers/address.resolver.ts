import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '@src/common/guards';
import { CurrentUser } from '@src/common/decorators';
import { User } from 'better-auth';
import { UserId } from '@module/user';
import {
  CreateAddressCommand,
  GetUserAddressesQuery,
  SetDefaultAddressCommand,
  DeleteAddressCommand,
  AddressDto,
} from '../../application';
import { AddressGraphQLType, CreateAddressInput } from '../graphql';

@Resolver(() => AddressGraphQLType)
@UseGuards(GqlAuthGuard)
export class AddressResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Query(() => [AddressGraphQLType], {
    name: 'myAddresses',
    description: 'Get all saved addresses for the authenticated user',
  })
  async myAddresses(@CurrentUser() user: User): Promise<AddressDto[]> {
    return this.queryBus.execute(
      new GetUserAddressesQuery(UserId.fromString(user.id)),
    );
  }

  @Mutation(() => AddressGraphQLType, {
    name: 'createAddress',
    description: 'Create a new saved address for the authenticated user',
  })
  async createAddress(
    @CurrentUser() user: User,
    @Args('input') input: CreateAddressInput,
  ): Promise<AddressDto> {
    return this.commandBus.execute(
      new CreateAddressCommand({
        ...input,
        userId: UserId.fromString(user.id),
      }),
    );
  }

  @Mutation(() => Boolean, {
    name: 'setDefaultAddress',
    description: 'Set an address as the default for the authenticated user',
  })
  async setDefaultAddress(
    @CurrentUser() user: User,
    @Args('addressId') addressId: string,
  ): Promise<boolean> {
    return this.commandBus.execute(
      new SetDefaultAddressCommand({
        addressId,
        userId: UserId.fromString(user.id),
      }),
    );
  }

  @Mutation(() => Boolean, {
    name: 'deleteAddress',
    description: 'Delete an address for the authenticated user',
  })
  async deleteAddress(
    @CurrentUser() user: User,
    @Args('addressId') addressId: string,
  ): Promise<boolean> {
    return this.commandBus.execute(
      new DeleteAddressCommand({
        addressId,
        userId: UserId.fromString(user.id),
      }),
    );
  }
}
