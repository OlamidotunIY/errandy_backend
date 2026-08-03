import { ApplicationStatus, ApplicationType } from '@src/modules';

export interface GetApplicationQueryDTO {
  applications: ApplicationDto[];
  nextCursor?: string | null;
}

export interface ApplicationDto {
  id: string;
  errandId: string;
  providerPartyId: string;
  status: ApplicationStatus;
  type: ApplicationType;
  proposal: string;
  proposedAmountMinorUnits: number;
  currency: string;
  acceptedAt?: Date | null;
  rejectedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
