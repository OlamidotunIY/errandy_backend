import { PartyId } from '@module/party';
import { ApplicationId } from '@src/modules';

export interface RequestApplicationAcceptancePayload {
  clientPartyId: PartyId;
  applicationId: ApplicationId;
  paymentMethodId: string;
}
