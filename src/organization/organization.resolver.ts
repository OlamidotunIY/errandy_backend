import { Resolver, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { Organization } from './entities/organization.entity';
import { GqlAuthGuard } from 'src/auth/guard/graphql-auth.guard';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { User } from 'src/users/entities/user.entity';

@Resolver(() => Organization)
@UseGuards(GqlAuthGuard)
export class OrganizationResolver {
  constructor(private readonly organizationService: OrganizationService) {}

  @Query(() => Organization, { name: 'myOrganization', nullable: true })
  getMyOrganization(@CurrentUser() user: User) {
    return this.organizationService.getMyOrganization(user.id);
  }
}
