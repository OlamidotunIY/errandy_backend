import { Injectable } from '@nestjs/common';
import {
  ErrandAssignmentSnapshot,
  ErrandSnapshot,
  IErrandReadPort,
} from '@src/common';
import { IErrandRepository } from '../../domain';

@Injectable()
export class ErrandReadAdapter extends IErrandReadPort {
  constructor(private readonly errandRepository: IErrandRepository) {
    super();
  }

  async findById(errandId: string): Promise<ErrandSnapshot | null> {
    const errand = await this.errandRepository.findById(errandId);
    if (!errand) {
      return null;
    }

    return {
      id: errand.id.value,
      clientPartyId: errand.clientPartyId,
      status: errand.status,
    };
  }

  async findAssignmentsByErrandId(
    errandId: string,
  ): Promise<ErrandAssignmentSnapshot[]> {
    const assignments =
      await this.errandRepository.findAssignmentsByErrandId(errandId);

    return assignments.map((assignment) => ({
      providerPartyId: assignment.providerPartyId,
      assignedByOrganizationId: assignment.assignedByOrganizationId ?? null,
    }));
  }
}
