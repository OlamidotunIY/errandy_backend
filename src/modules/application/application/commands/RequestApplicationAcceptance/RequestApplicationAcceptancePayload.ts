import { ClientId } from '@module/clients';
import { ApplicationId } from '@src/modules';

export interface RequestApplicationAcceptancePayload {
  clientId: ClientId;
  applicationId: ApplicationId;
}
