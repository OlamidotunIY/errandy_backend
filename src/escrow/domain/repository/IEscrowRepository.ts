import { Escrow, EscrowId } from '..';

interface IEscrowRepository {
  findById(id: EscrowId): Promise<Escrow | null>;
}

export { IEscrowRepository };
