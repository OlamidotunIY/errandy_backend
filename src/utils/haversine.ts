/**
 * Haversine formula for calculating distance between two geographic points
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoJSON {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two points using Haversine formula
 * @param point1 First geographic point
 * @param point2 Second geographic point
 * @returns Distance in kilometers
 */
export function calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
  const R = 6371; // Earth radius in kilometers
  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lng - point1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) *
      Math.cos(toRad(point2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert GeoJSON to GeoPoint
 */
export function geoJSONToPoint(geoJSON: GeoJSON): GeoPoint {
  return {
    lng: geoJSON.coordinates[0],
    lat: geoJSON.coordinates[1],
  };
}

/**
 * Validate if a member is within acceptable distance from errand location
 * @param errandLocation Errand location in GeoJSON format
 * @param memberLocation Member location in GeoJSON format
 * @param maxDistanceKm Maximum allowed distance in kilometers (default: 50)
 * @returns true if within distance, false otherwise
 */
export function isWithinDistance(
  errandLocation: GeoJSON,
  memberLocation: GeoJSON,
  maxDistanceKm: number = 50,
): boolean {
  const errandPoint = geoJSONToPoint(errandLocation);
  const memberPoint = geoJSONToPoint(memberLocation);
  const distance = calculateDistance(errandPoint, memberPoint);
  return distance <= maxDistanceKm;
}
