export interface ServiceSnapshot {
  id: string;
  listedById: string;
  categoryId: string;
  title: string;
  description: string;
  priceMinorUnits: number;
  currency: string;
  isActive: boolean;
}

/**
 * Read-only query port owned by the Service module (adapter lives there).
 */
export abstract class IServiceReadPort {
  abstract findById(serviceId: string): Promise<ServiceSnapshot | null>;
}
