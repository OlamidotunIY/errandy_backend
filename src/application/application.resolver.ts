// import { Resolver, Mutation, Args, Query, ResolveField, Parent, ID } from '@nestjs/graphql';
// import { ApplicationService } from './application.service';
// import { Application } from './entities/application.entity';
// import { CreateApplicationInput } from './dto/create-application.input';
// import { UseGuards } from '@nestjs/common';
// import { GqlAuthGuard } from 'src/auth/guard/graphql-auth.guard';
// import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
// import { User } from 'src/users/entities/user.entity';
// import { Provider } from 'src/provider/entities/provider.entity';
// import { PrismaService } from 'src/prisma.service';
// import { AcceptApplicationInput } from './dto/accept-application.input';
// import { Errand } from 'src/errands/entities/errand.entity';
// import { ErrandApplicationSummary } from './entities/errand-application-summary.entity';
//
// @Resolver(() => Application)
// export class ApplicationResolver {
//   constructor(
//     private readonly applicationService: ApplicationService,
//     private readonly prisma: PrismaService,
//   ) {}
//
//   @UseGuards(GqlAuthGuard)
//   @Query(() => Application, { nullable: true })
//   myApplicationForErrand(
//     @Args('errandId', { type: () => ID }) errandId: string,
//     @CurrentUser() user: User,
//   ) {
//     return this.applicationService.myApplicationForErrand(errandId, user.id);
//   }
//
//   @UseGuards(GqlAuthGuard)
//   @Query(() => Application)
//   application(
//     @Args('id', { type: () => ID }) id: string,
//     @CurrentUser() user: User,
//   ) {
//     return this.applicationService.getApplicationById(id, user.id);
//   }
//
//   @UseGuards(GqlAuthGuard)
//   @Query(() => [Application])
//   errandApplications(
//     @Args('errandId', { type: () => ID }) errandId: string,
//     @CurrentUser() user: User,
//   ) {
//     return this.applicationService.errandApplications(errandId, user.id);
//   }
//
//   @UseGuards(GqlAuthGuard)
//   @Query(() => ErrandApplicationSummary)
//   errandApplicationSummary(
//     @Args('errandId', { type: () => ID }) errandId: string,
//     @CurrentUser() user: User,
//   ) {
//     return this.applicationService.errandApplicationSummary(errandId, user.id);
//   }
//
//   @UseGuards(GqlAuthGuard)
//   @Mutation(() => Application)
//   apply(
//     @Args('createApplicationInput') createApplicationInput: CreateApplicationInput,
//     @CurrentUser() user: User,
//   ) {
//     return this.applicationService.apply(createApplicationInput, user.id);
//   }
//
//   @UseGuards(GqlAuthGuard)
//   @Mutation(() => Errand)
//   acceptApplication(
//     @Args('input') input: AcceptApplicationInput,
//     @CurrentUser() user: User,
//   ) {
//     return this.applicationService.acceptApplication(input, user.id);
//   }
//
//   @ResolveField(() => Provider, { nullable: true })
//   async worker(@Parent() application: Application) {
//     if (!application.workerId) {
//       return null;
//     }
//
//     return this.prisma.provider.findUnique({
//       where: { id: application.workerId },
//       include: { user: true },
//     });
//   }
// }
