import { AggregateRoot } from '@src/common';
import { OrganizationMemberId, OrgMemberRole, PartyId } from '@module/party';
import { UserId } from '@module/user';

export class OrganizationMember extends AggregateRoot<OrganizationMemberId> {
  constructor(
    public readonly id: OrganizationMemberId,
    public readonly organizationId: PartyId,
    public readonly userId: UserId,
    private _role: OrgMemberRole,
    private _active: boolean,
  ) {
    super(id);
  }
}
