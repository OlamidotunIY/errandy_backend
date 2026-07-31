import { ILogger } from '@src/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { EscrowMapper } from 'src/modules/escrow/infrastructure';
import {
  Escrow,
  EscrowId,
  EscrowInvariantError,
  EscrowRepository,
} from '@module/escrow/domain';
import { ErrandId } from '@module/errand';

export class PrismaEscrowRepository implements EscrowRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: ILogger,
    private readonly mapper: EscrowMapper,
  ) {}

  async findByErrandId(errandId: ErrandId): Promise<Escrow | null> {
    const escrow = await this.prisma.escrow.findUnique({
      where: {
        errandId: errandId.value,
      },
    });

    if (!escrow) {
      this.logger.error(`Escrow not found for errandId: ${errandId.value}`);
      throw new EscrowInvariantError(
        `Escrow not found for errandId: ${errandId.value}`,
      );
    }

    return this.mapper.toDomain(escrow);
  }

  async findById(id: EscrowId): Promise<Escrow | null> {
    const escrow = await this.prisma.escrow.findUnique({
      where: {
        id: id.value,
      },
    });

    if (!escrow) {
      this.logger.error(`Escrow not found for id: ${id.value}`);
      throw new EscrowInvariantError(`Escrow not found for id: ${id.value}`);
    }

    return this.mapper.toDomain(escrow);
  }

  async findMaturedForRelease(): Promise<Escrow[]> {
    const today = new Date();

    const maturedEscrows = await this.prisma.escrow.findMany({
      where: {
        holdUntil: {
          lte: today,
        },
      },
    });

    return maturedEscrows.map((escrow) => this.mapper.toDomain(escrow));
  }

  async save(escrow: Escrow): Promise<void> {
    const existingEscrow = await this.prisma.escrow.findUnique({
      where: {
        id: escrow.id.value,
      },
    });

    if (existingEscrow) {
      await this.prisma.escrow.update({
        where: {
          id: escrow.id.value,
        },
        data: this.mapper.toPersistence(escrow),
      });
    } else {
      await this.prisma.escrow.create({
        data: this.mapper.toPersistence(escrow),
      });
    }
  }
}
