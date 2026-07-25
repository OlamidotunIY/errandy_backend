import { ErrandId } from '@errands';
import { Escrow, EscrowId, EscrowStatus } from '..';
import { ClientId } from '@client';
import { ProviderId } from '@provider';

abstract class EscrowRepository {
  abstract findById(id: EscrowId): Promise<Escrow | null>;
  abstract findByErrandId(errandId: ErrandId): Promise<Escrow | null>;
  abstract findByClientId(
    clientId: ClientId,
    status?: EscrowStatus,
  ): Promise<Escrow[]>;
  abstract findByWorkerId(
    workerId: ProviderId,
    status?: EscrowStatus,
  ): Promise<Escrow[]>;
  abstract findMaturedForRelease(): Promise<Escrow[]>;
  abstract save(escrow: Escrow): Promise<void>;
}

export { EscrowRepository };
