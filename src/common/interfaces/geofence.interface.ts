/**
 * Minimal geofence shape for point-in-geofence checks.
 * Common layer must not depend on TypeORM entities; Geofence entity satisfies this interface.
 */

export interface IGeofenceShape {
  latitude: string;
  longitude: string;
  type: string | null;
  radius: string | null;
  coordinates: number[][] | null;
  threshold_enabled?: boolean;
  threshold_distance?: string | null;
}
