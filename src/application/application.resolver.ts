import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { ApplicationService } from './application.service';
import { Application } from './entities/application.entity';
import { CreateApplicationInput } from './dto/create-application.input';
import { UpdateApplicationInput } from './dto/update-application.input';

@Resolver(() => Application)
export class ApplicationResolver {
  constructor(private readonly applicationService: ApplicationService) {}

  @Mutation(() => Application)
  createApplication(@Args('createApplicationInput') createApplicationInput: CreateApplicationInput) {
    return this.applicationService.create(createApplicationInput);
  }

  @Query(() => [Application], { name: 'application' })
  findAll() {
    return this.applicationService.findAll();
  }

  @Query(() => Application, { name: 'application' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.applicationService.findOne(id);
  }

  @Mutation(() => Application)
  updateApplication(@Args('updateApplicationInput') updateApplicationInput: UpdateApplicationInput) {
    return this.applicationService.update(updateApplicationInput.id, updateApplicationInput);
  }

  @Mutation(() => Application)
  removeApplication(@Args('id', { type: () => Int }) id: number) {
    return this.applicationService.remove(id);
  }
}
