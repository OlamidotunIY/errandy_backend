import { PartyId, ProviderTier } from '@module/party';

export class ProviderRole {
  constructor(
    public readonly id: PartyId,
    private _tier: ProviderTier = ProviderTier.COMMUNITY,
    private _skills: string[] = [],
    private _verificationStatus: boolean = false,
    private _trustedByCount: number = 0,
    private _completedErrandsCount: number = 0,
    private _disputedErrandsCount: number = 0,
    private _isActive: boolean = true,
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    private _bio?: string,
    private _avgResponseTimeSeconds?: number,
    private _avgRatingCached?: number,
  ) {}
}
