import { ErrandId } from '@module/errands';
import { Escrow, EscrowId } from '..';

abstract class EscrowRepository {
  abstract findById(id: EscrowId): Promise<Escrow | null>;
  abstract findByErrandId(errandId: ErrandId): Promise<Escrow | null>;
  // abstract findByClientId(
  //   clientPartyId: ClientId,
  //   status?: EscrowStatus,
  // ): Promise<Escrow[]>;
  // abstract findByWorkerId(
  //   providerPartyId: ProviderId,
  //   status?: EscrowStatus,
  // ): Promise<Escrow[]>;
  abstract findMaturedForRelease(): Promise<Escrow[]>;
  abstract save(escrow: Escrow): Promise<void>;
}

export { EscrowRepository };
