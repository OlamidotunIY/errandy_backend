import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { ApplicationService } from './application.service';
import { Application } from './entities/application.entity';
import { CreateApplicationInput } from './dto/create-application.input';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from 'src/auth/guard/graphql-auth.guard';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { User } from 'src/users/entities/user.entity';

@Resolver(() => Application)
export class ApplicationResolver {
  constructor(private readonly applicationService: ApplicationService) {}

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Application)
  apply(
    @Args('createApplicationInput') createApplicationInput: CreateApplicationInput,
    @CurrentUser() user: User,
  ) {
    return this.applicationService.apply(createApplicationInput, user.id);
  }
}
