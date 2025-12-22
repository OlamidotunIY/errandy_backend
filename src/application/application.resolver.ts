import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { ApplicationService } from './application.service';
import { Application } from './entities/application.entity';
import { CreateApplicationInput } from './dto/create-application.input';
import { UseGuards } from '@nestjs/common';
import { AuthGuard, Session, UserSession } from '@thallesp/nestjs-better-auth';

@Resolver(() => Application)
export class ApplicationResolver {
  constructor(private readonly applicationService: ApplicationService) {}

  @UseGuards(AuthGuard)
  @Mutation(() => Application)
  apply(
    @Args('createApplicationInput') createApplicationInput: CreateApplicationInput,
    @Session() session: UserSession,
  ) {
    return this.applicationService.apply(createApplicationInput, session.user.id);
  }
}
