import { ApplicationStatus, ApplicationType } from '@src/modules';

export interface GetApplicationQueryDTO {
  applications: Application[];
  nextCursor?: string | null;
}

export interface Application {
  id: string;
  errandId: string;
  workerId: string;
  status: ApplicationStatus;
  type: ApplicationType;
  proposal: string;
  proposedAmountKobo: number;
  currency: string;
  acceptedAt?: Date | null;
  rejectedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
