import { OrganizationMember, PartyId, Person } from '@module/party';
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
}
