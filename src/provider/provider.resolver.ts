import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { ProviderService } from './provider.service';
import { Provider } from './entities/provider.entity';
import { CreateProviderInput } from './dto/create-provider.input';
import { UpdateProviderInput } from './dto/update-provider.input';
import { SearchProvidersInput } from './dto/search-providers.input';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from 'src/auth/guard/graphql-auth.guard';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { User } from 'src/users/entities/user.entity';
import { ProviderDiscoveryResponse } from './dto/provider-discovery.response';

@Resolver(() => Provider)
@UseGuards(GqlAuthGuard)
export class ProviderResolver {
  constructor(private readonly providerService: ProviderService) {}

  @Query(() => ProviderDiscoveryResponse, { name: 'getProviders' })
  getProviders(@CurrentUser() user: User) {
    return this.providerService.getProviders(user.id);
  }

  @Query(() => [Provider], { name: 'searchProviders' })
  searchProviders(
    @Args('input') input: SearchProvidersInput,
    @CurrentUser() user: User,
  ) {
    return this.providerService.searchProviders(input);
  }
}
