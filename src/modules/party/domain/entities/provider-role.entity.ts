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

  recordVerificationCompleted(tier: ProviderTier): void {
    this._verificationStatus = true;
    this._tier = tier;
    this.updatedAt = new Date();
  }

  updateProfile(bio?: string, skills?: string[]): void {
    if (bio !== undefined) {
      this._bio = bio;
    }
    if (skills !== undefined) {
      this._skills = skills;
    }
    this.updatedAt = new Date();
  }

  incrementTrustedByCount(): void {
    this._trustedByCount++;
    this.updatedAt = new Date();
  }

  decrementTrustedByCount(): void {
    if (this._trustedByCount > 0) {
      this._trustedByCount--;
    }
    this.updatedAt = new Date();
  }

  incrementCompletedErrandsCount(): void {
    this._completedErrandsCount++;
    this.updatedAt = new Date();
  }

  incrementDisputedErrandsCount(): void {
    this._disputedErrandsCount++;
    this.updatedAt = new Date();
  }

  recomputeAvgRating(newWeightedAverage: number): void {
    this._avgRatingCached = newWeightedAverage;
    this.updatedAt = new Date();
  }
}
