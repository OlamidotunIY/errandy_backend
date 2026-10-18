import { Dispute, DisputeStatus } from '../entities';

export abstract class IDisputeRepository {
  abstract findById(id: string): Promise<Dispute | null>;
  abstract findByErrandId(errandId: string): Promise<Dispute[]>;
  abstract findByRaisedById(raisedById: string): Promise<Dispute[]>;
  abstract findAll(status?: DisputeStatus, limit?: number): Promise<Dispute[]>;
  abstract save(dispute: Dispute): Promise<void>;
}
