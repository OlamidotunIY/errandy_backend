import { ApplicationId } from '@module/application';
import { ErrandId } from '@src/errands';

export interface AcceptApplicationPayload {
  id: ApplicationId;
  errandId: ErrandId;
}
