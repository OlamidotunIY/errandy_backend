import { ErrandId } from '@module/errand';

export interface GetEscrowByErrandPayload {
  errandId: ErrandId;
}

export interface EscrowDTO {
  id: string;
  errandId: string;
  clientId: string;
  workerId: string;
  amountGross: number;
  amountNetWorker: number;
  platformFee: number;
  status: string;
  holdUntil: Date | null;
  releasedAt: Date | null;
  refundedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
