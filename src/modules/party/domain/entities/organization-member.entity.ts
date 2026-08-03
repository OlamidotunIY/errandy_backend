import { AggregateRoot } from '@src/common';
import { OrganizationMemberId, OrgMemberRole, PartyId } from '@module/party';
import { UserId } from '@module/user';

export class OrganizationMember extends AggregateRoot<OrganizationMemberId> {
  constructor(
    public readonly id: OrganizationMemberId,
    public readonly organizationPartyId: PartyId,
    public readonly userId: UserId,
    private _role: OrgMemberRole,
    private _active: boolean,
  ) {
    super(id);
  }

  get role(): OrgMemberRole {
    return this._role;
  }

  get active(): boolean {
    return this._active;
  }
}
