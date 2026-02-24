/**
 * Geofence utility constants (geometry, defaults, messages).
 */

/** Earth radius in meters (WGS84). */
export const EARTH_RADIUS_METERS = 6_371_000;

/** Approximate meters per degree latitude at equator. */
export const METERS_PER_DEGREE_LAT = 111_000;

/** Margin in meters for boundary proximity (inside/edge). */
export const GEOFENCE_MARGIN_METERS = 20;

/** Default radius in meters for legacy circle geofences (when type is null). */
export const GEOFENCE_DEFAULT_RADIUS_METERS = 100;

export const GEOFENCE_MESSAGE = {
  INVALID_COORDINATES: 'Invalid geofence coordinates',
  INVALID_RECTANGLE_COORDINATES: 'Invalid rectangle coordinates format',
  INVALID_POLYGON_COORDINATES: 'Invalid polygon coordinates format',
} as const;
