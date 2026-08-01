import { PartyId } from '@module/party';
import { ApplicationId } from '@src/modules';

export interface RequestApplicationAcceptancePayload {
  clientId: PartyId;
  applicationId: ApplicationId;
}
