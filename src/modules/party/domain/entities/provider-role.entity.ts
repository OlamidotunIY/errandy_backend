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

  private touch(): void {
    this.updatedAt = new Date();
  }

  recordVerificationCompleted(tier: ProviderTier): void {
    this._verificationStatus = true;
    this._tier = tier;
    this.touch();
  }

  updateProfile(bio?: string, skills?: string[], addToSkills: boolean = false): void {
    if (bio !== undefined) {
      this._bio = bio;
    }
    if (skills !== undefined) {
      if (addToSkills) {
        this._skills = [...new Set([...this._skills, ...skills])];
      } else {
        this._skills = skills;
      }
    }
    this.touch();
  }

  incrementTrustedByCount(): void {
    this._trustedByCount++;
    this.touch();
  }

  decrementTrustedByCount(): void {
    if (this._trustedByCount > 0) {
      this._trustedByCount--;
    }
    this.touch();
  }

  incrementCompletedErrandsCount(): void {
    this._completedErrandsCount++;
    this.touch();
  }

  incrementDisputedErrandsCount(): void {
    this._disputedErrandsCount++;
    this.touch();
  }

  recomputeAvgRating(newWeightedAverage: number): void {
    this._avgRatingCached = newWeightedAverage;
    this.touch();
  }
}
