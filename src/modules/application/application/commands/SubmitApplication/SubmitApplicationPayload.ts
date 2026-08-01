import { ApplicationType } from '@module/application/domain';
import { ErrandId } from '@module/errand';
import { ProviderId } from '@module/providers';

export interface SubmitApplicationPayload {
  errandId: ErrandId;
  workerId: ProviderId;
  proposal: string;
  proposedAmountMinorUnits: number;
  currency: string;
  applicantType: ApplicationType;
}
