import { OrgMemberRole } from '@module/party';

export interface AddOrganizationMemberRequestDto {
  organizationPartyId: string;
  userId: string;
  role: OrgMemberRole;
}

export interface AddOrganizationMemberResponseDto {
  organizationPartyId: string;
  userId: string;
  role: OrgMemberRole;
}
