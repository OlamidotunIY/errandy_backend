import { Errand } from '../entities/errand.entity';
import { ErrandAssignment } from '../entities/errand-assignment.entity';

export abstract class IErrandRepository {
  abstract save(errand: Errand): Promise<void>;
  abstract findById(id: string): Promise<Errand | null>;
  abstract findByClientId(clientId: string): Promise<Errand[]>;
  abstract findOpenErrands(filters: {
    marketId: string;
    categoryId?: string;
    requesterTier: string;
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
    limit?: number;
  }): Promise<Errand[]>;
  abstract findAssignedPastStart(): Promise<Errand[]>;
  abstract findInactiveOlderThan(date: Date): Promise<Errand[]>;

  abstract saveAssignment(assignment: ErrandAssignment): Promise<void>;
  abstract findAssignmentsByErrandId(
    errandId: string,
  ): Promise<ErrandAssignment[]>;
  abstract findAssignmentById(id: string): Promise<ErrandAssignment | null>;
}
