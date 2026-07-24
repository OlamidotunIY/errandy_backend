// import { Resolver, Query } from '@nestjs/graphql';
// import { UseGuards } from '@nestjs/common';
// import { ClientService } from './client.service';
// import { ClientDashboard } from './entities/client-dashboard.entity';
// import { GqlAuthGuard } from 'src/auth/guard/graphql-auth.guard';
// import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
//
// @Resolver()
// export class ClientResolver
// {
//     constructor(private readonly clientService: ClientService) { }
//
//     @Query(() => ClientDashboard, {
//         description: 'Get client dashboard data including requirements and errands',
//     })
//     @UseGuards(GqlAuthGuard)
//     async clientDashboard(@CurrentUser() user: { id: string })
//     {
//         return this.clientService.getClientDashboard(user.id);
//     }
// }
