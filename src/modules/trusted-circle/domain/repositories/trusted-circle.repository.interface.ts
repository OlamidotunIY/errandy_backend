import { TrustedCircle } from '../entities';

export abstract class ITrustedCircleRepository {
  abstract findById(id: string): Promise<TrustedCircle | null>;
  abstract findByOwnerPartyId(ownerPartyId: string): Promise<TrustedCircle | null>;
  abstract save(circle: TrustedCircle): Promise<void>;
}
