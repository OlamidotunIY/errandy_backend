import {
  OrganizationMember,
  OrganizationMemberId,
  OrgMemberRole,
  PartyId,
} from '@module/party';
import {
  OrganizationMemberAlreadyExistsError,
  OrganizationMemberNotFoundError,
} from '../errors';
import { UserId } from '@module/user';

export class Organization {
  constructor(
    public readonly id: PartyId,
    private _name: string,
    private _businessRegistrationNumber: string,
    public readonly ownerId: UserId,
    public readonly createdAt: Date,
    public updatedAt: Date,
    private _workerPoolPercentage: number = 70,
    private readonly _orgMembers: OrganizationMember[] = [],
  ) {}

  private touch(): void {
    this.updatedAt = new Date();
  }

  addMember(userId: UserId, role: OrgMemberRole): void {
    const existingMember = this._orgMembers.find((member) =>
      member.userId.equals(userId),
    );

    if (existingMember) {
      throw new OrganizationMemberAlreadyExistsError(userId.value);
    }

    this._orgMembers.push(
      new OrganizationMember(
        OrganizationMemberId.create(),
        this.id,
        userId,
        role,
        true,
      ),
    );
    this.touch();
  }

  removeMember(userId: UserId): void {
    const index = this._orgMembers.findIndex((member) =>
      member.userId.equals(userId),
    );

    if (index === -1) {
      throw new OrganizationMemberNotFoundError(userId.value);
    }

    this._orgMembers.splice(index, 1);
    this.touch();
  }

  updateWorkerPoolPercentage(percentage: number): void {
    this._workerPoolPercentage = percentage;
    this.touch();
  }
}
