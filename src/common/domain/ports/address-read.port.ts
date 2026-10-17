export interface GeoJsonPointSnapshot {
  type: 'Point';
  coordinates: [number, number];
}

/**
 * Read-only query port owned by the Address module (adapter lives there).
 */
export abstract class IAddressReadPort {
  /** Returns the GeoJSON location of an address, or null when it does not exist. */
  abstract findLocationById(
    addressId: string,
  ): Promise<GeoJsonPointSnapshot | null>;
}
