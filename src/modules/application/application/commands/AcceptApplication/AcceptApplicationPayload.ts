import { ApplicationId } from '@module/application';
import { ErrandId } from '@module/errand';

export interface AcceptApplicationPayload {
  id: ApplicationId;
  errandId: ErrandId;
}
