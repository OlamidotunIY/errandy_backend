import { ApplicationId } from '@module/application';

export interface AcceptApplicationPayload {
  id: ApplicationId;
  gatewayReference: string;
  correlationId: string;
}
