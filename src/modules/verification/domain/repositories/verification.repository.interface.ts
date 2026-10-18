import { VerificationProfile } from '../entities';

export abstract class IVerificationRepository {
  abstract findById(id: string): Promise<VerificationProfile | null>;
  abstract findByPartyId(partyId: string): Promise<VerificationProfile | null>;
  abstract save(profile: VerificationProfile): Promise<void>;
}
