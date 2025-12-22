import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UsersService } from './users.service';
import { GqlUserRole, User } from './entities/user.entity';
import { AddWorkerServicesInput } from './dto/add-worker-services.input';
import { UpdateUserInput } from './dto/update-user.input';
import { UseGuards } from '@nestjs/common';
import { CreateAddressInput } from './dto/create-user.input';
import { Search } from './entities/search-history.entities';
import { AuthGuard, Session, UserSession } from '@thallesp/nestjs-better-auth';

@Resolver(() => User)
@UseGuards(AuthGuard)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => User, { name: 'user' })
  findOne(@Session() session: UserSession) {
    return this.usersService.findOne(session.user.id);
  }

  @Mutation(() => User)
  updateUser(@Args('updateUserInput') updateUserInput: UpdateUserInput) {
    return this.usersService.update(updateUserInput);
  }

  @Mutation(() => User)
  addAddress(@Args('dto') dto: CreateAddressInput, @Session() session: UserSession) {
    return this.usersService.addAddress(dto, session.user.id);
  }

  @Mutation(() => User)
  createUserRole(@Args('role') role: GqlUserRole, @Session() session: UserSession) {
    return this.usersService.createUserRole(session.user.id, role);
  }

  @Mutation(() => User)
  addWorkerServices(
    @Args('dto') dto: AddWorkerServicesInput,
    @Session() session: UserSession,
  ) {
    return this.usersService.addServicesToWorker(dto.serviceIds, session.user.id);
  }

  @Query(() => [Search], {
    name: 'userSearchHistory',
    description: 'Get user search history for workers',
  })
  getUserSearchHistory(@Session() session: UserSession) {
    return this.usersService.getUserSearchHistory(session.user.id);
  }

  @Mutation(() => Boolean, {
    description: 'Clear user search history',
  })
  async clearSearchHistory(@Session() session: UserSession) {
    const result = await this.usersService.clearSearchHistory(session.user.id);
    return result.success;
  }
}
