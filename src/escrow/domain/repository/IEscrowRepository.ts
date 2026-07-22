import { ErrandId } from '@errands';
import { Escrow, EscrowId, EscrowStatus } from '..';
import { ClientId } from '@client';
import { ProviderId } from '@provider';

interface IEscrowRepository {
  findById(id: EscrowId): Promise<Escrow | null>;
  findByErrandId(errandId: ErrandId): Promise<Escrow | null>;
  findByClientId(clientId: ClientId, status?: EscrowStatus): Promise<Escrow[]>;
  findByWorkerId(
    workerId: ProviderId,
    status?: EscrowStatus,
  ): Promise<Escrow[]>;
  findMaturedForRelease(): Promise<Escrow[]>;
  save(escrow: Escrow): Promise<void>;
}

export { IEscrowRepository };
