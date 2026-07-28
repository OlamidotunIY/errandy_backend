import { ApplicationId } from '@application/domain';
import { ErrandId } from '@errands';

export interface AcceptApplicationPayload {
  id: ApplicationId;
  errandId: ErrandId;
}
