export interface ErrandSnapshot {
  id: string;
  clientPartyId: string;
  status: string;
}

export interface ErrandAssignmentSnapshot {
  providerPartyId: string;
  assignedByOrganizationId: string | null;
}

/**
 * Read-only query port owned by the Errands module (adapter lives there).
 */
export abstract class IErrandReadPort {
  abstract findById(errandId: string): Promise<ErrandSnapshot | null>;
  abstract findAssignmentsByErrandId(
    errandId: string,
  ): Promise<ErrandAssignmentSnapshot[]>;
}
