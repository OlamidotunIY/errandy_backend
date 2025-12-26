import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UsersService } from './users.service';
import { GqlUserRole, User } from './entities/user.entity';
import { AddWorkerServicesInput } from './dto/add-worker-services.input';
import { UpdateUserInput } from './dto/update-user.input';
import { UseGuards } from '@nestjs/common';
import { CreateAddressInput } from './dto/create-user.input';
import { Search } from './entities/search-history.entities';
import { GqlAuthGuard } from 'src/auth/guard/graphql-auth.guard';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';

@Resolver(() => User)
@UseGuards(GqlAuthGuard)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => User, { name: 'user' })
  findOne(@CurrentUser() user: User) {
    return this.usersService.findOne(user.id);
  }

  @Mutation(() => User)
  updateUser(@Args('updateUserInput') updateUserInput: UpdateUserInput) {
    return this.usersService.update(updateUserInput);
  }

  @Mutation(() => User)
  addAddress(@Args('dto') dto: CreateAddressInput, @CurrentUser() user: User) {
    return this.usersService.addAddress(dto, user.id);
  }

  @Mutation(() => User)
  createUserRole(@Args('role', { type: () => GqlUserRole }) role: GqlUserRole, @CurrentUser() user: User) {
    return this.usersService.createUserRole(user.id, role);
  }

  @Mutation(() => User)
  addWorkerServices(
    @Args('dto') dto: AddWorkerServicesInput,
    @CurrentUser() user: User,
  ) {
    return this.usersService.addServicesToWorker(dto.serviceIds, user.id);
  }

  @Query(() => [Search], {
    name: 'userSearchHistory',
    description: 'Get user search history for workers',
  })
  getUserSearchHistory(@CurrentUser() user: User) {
    return this.usersService.getUserSearchHistory(user.id);
  }

  @Mutation(() => Boolean, {
    description: 'Clear user search history',
  })
  async clearSearchHistory(@CurrentUser() user: User) {
    const result = await this.usersService.clearSearchHistory(user.id);
    return result.success;
  }
}
