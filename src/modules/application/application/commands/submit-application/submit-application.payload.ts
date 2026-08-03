import { PartyId } from '@module/party';
import { ApplicationType } from '@module/application/domain';
import { ErrandId } from '@module/errands';

export interface SubmitApplicationPayload {
  errandId: ErrandId;
  providerPartyId: PartyId;
  proposal: string;
  proposedAmountMinorUnits: number;
  currency: string;
  applicantType: ApplicationType;
}
