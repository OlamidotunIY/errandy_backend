import { PartyId } from '@module/party';
import { ApplicationId } from '../../../domain';

export interface RequestApplicationAcceptancePayload {
  clientPartyId: PartyId;
  applicationId: ApplicationId;
  paymentMethodId: string;
}
