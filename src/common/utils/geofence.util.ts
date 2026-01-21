/**
 * Geofence validation utilities
 * Validates if a point (latitude, longitude) is within a geofence boundary
 */

import { Geofence, GeofenceType } from '../../entities/geofence.entity';

// 50 meters margin for GPS accuracy
const GEOFENCE_MARGIN_METERS = 50;

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance from point to line segment (in meters)
 */
function distanceToLineSegment(
  pointLat: number,
  pointLng: number,
  lineLat1: number,
  lineLng1: number,
  lineLat2: number,
  lineLng2: number,
): number {
  // Calculate closest point on line segment to the point
  const A = pointLat - lineLat1;
  const B = pointLng - lineLng1;
  const C = lineLat2 - lineLat1;
  const D = lineLng2 - lineLng1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let closestLat: number, closestLng: number;

  if (param < 0) {
    closestLat = lineLat1;
    closestLng = lineLng1;
  } else if (param > 1) {
    closestLat = lineLat2;
    closestLng = lineLng2;
  } else {
    closestLat = lineLat1 + param * C;
    closestLng = lineLng1 + param * D;
  }

  // Calculate distance from point to closest point on segment
  return calculateDistance(pointLat, pointLng, closestLat, closestLng);
}

/**
 * Check if a point is inside a polygon using ray casting algorithm (with 50m margin)
 * Coordinates format: [[lat, lng], [lat, lng], ...]
 * Casts a horizontal ray (increasing longitude) and counts edge intersections
 */
function isPointInPolygon(
  pointLat: number,
  pointLng: number,
  coordinates: number[][],
): boolean {
  if (!coordinates || coordinates.length < 3) {
    return false;
  }

  // First check if point is inside polygon (original check)
  let inside = false;
  for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
    const [latI, lngI] = coordinates[i]; // [latitude, longitude]
    const [latJ, lngJ] = coordinates[j]; // [latitude, longitude]

    // Check if edge crosses the horizontal line at pointLat
    const edgeCrossesHorizontalLine = (latI > pointLat) !== (latJ > pointLat);
    
    if (edgeCrossesHorizontalLine) {
      // Calculate intersection longitude
      const intersectionLng = lngI + (lngJ - lngI) * (pointLat - latI) / (latJ - latI);
      
      // Check if intersection is to the right of the point (ray goes right)
      if (intersectionLng > pointLng) {
        inside = !inside;
      }
    }
  }

  // If point is inside polygon, return true
  if (inside) {
    return true;
  }

  // If not inside, check if point is within 50m of any edge
  for (let i = 0; i < coordinates.length; i++) {
    const [lat1, lng1] = coordinates[i];
    const [lat2, lng2] = coordinates[(i + 1) % coordinates.length];
    
    // Calculate distance from point to edge segment
    const distanceToEdge = distanceToLineSegment(
      pointLat, pointLng,
      lat1, lng1,
      lat2, lng2
    );
    
    if (distanceToEdge <= GEOFENCE_MARGIN_METERS) {
      return true; // Within 50m of edge
    }
  }

  return false;
}

/**
 * Check if a point is inside a rectangle (with 50m margin)
 * Assumes coordinates are [topLeft, topRight, bottomRight, bottomLeft] or similar
 */
function isPointInRectangle(
  pointLat: number,
  pointLng: number,
  coordinates: number[][],
): boolean {
  if (!coordinates || coordinates.length < 4) {
    return false;
  }

  // Find min/max lat and lng
  const lats = coordinates.map((coord) => coord[0]);
  const lngs = coordinates.map((coord) => coord[1]);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Calculate margin in degrees (approximate)
  // 1 degree latitude ≈ 111km, so 50m ≈ 0.00045 degrees
  const latMargin = GEOFENCE_MARGIN_METERS / 111000; // ~0.00045 degrees
  const avgLat = (minLat + maxLat) / 2;
  const lngMargin = GEOFENCE_MARGIN_METERS / (111000 * Math.cos(toRadians(avgLat)));

  return (
    pointLat >= (minLat - latMargin) &&
    pointLat <= (maxLat + latMargin) &&
    pointLng >= (minLng - lngMargin) &&
    pointLng <= (maxLng + lngMargin)
  );
}

/**
 * Check if a point is within a circle (with 50m margin)
 */
function isPointInCircle(
  pointLat: number,
  pointLng: number,
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
): boolean {
  const distance = calculateDistance(pointLat, pointLng, centerLat, centerLng);
  // Add 50m margin to radius for GPS accuracy
  return distance <= (radiusMeters + GEOFENCE_MARGIN_METERS);
}

/**
 * Validate if a point (latitude, longitude) is within a geofence boundary
 * @param pointLat - Latitude of the point to check
 * @param pointLng - Longitude of the point to check
 * @param geofence - Geofence entity to check against
 * @returns true if point is within geofence, false otherwise
 */
export function isPointWithinGeofence(
  pointLat: number,
  pointLng: number,
  geofence: Geofence,
): boolean {
  // Convert string coordinates to numbers
  const geofenceLat = parseFloat(geofence.latitude);
  const geofenceLng = parseFloat(geofence.longitude);

  // Validate parsed coordinates
  if (isNaN(geofenceLat) || isNaN(geofenceLng)) {
    console.error(
      `Invalid geofence coordinates: lat=${geofence.latitude}, lng=${geofence.longitude}`,
    );
    return false;
  }

  // If no type specified, fall back to simple point check (backward compatibility)
  if (!geofence.type) {
    // For backward compatibility, check if point is very close to stored lat/lng
    // This is not ideal but maintains compatibility with old geofences
    const distance = calculateDistance(
      pointLat,
      pointLng,
      geofenceLat,
      geofenceLng,
    );
    return distance <= (100 + GEOFENCE_MARGIN_METERS); // 100m + 50m margin = 150m total
  }

  switch (geofence.type) {
    case GeofenceType.CIRCLE:
      if (!geofence.radius) {
        return false;
      }
      const radiusMeters = parseFloat(geofence.radius);
      if (isNaN(radiusMeters)) {
        return false;
      }
      return isPointInCircle(
        pointLat,
        pointLng,
        geofenceLat,
        geofenceLng,
        radiusMeters,
      );

    case GeofenceType.RECTANGLE:
      if (!geofence.coordinates || geofence.coordinates.length < 4) {
        return false;
      }
      // Normalize coordinates (convert strings to numbers if needed)
      const normalizedRectCoords = geofence.coordinates.map((coord) => {
        if (Array.isArray(coord) && coord.length === 2) {
          return [
            typeof coord[0] === 'string' ? parseFloat(coord[0]) : coord[0],
            typeof coord[1] === 'string' ? parseFloat(coord[1]) : coord[1],
          ];
        }
        return coord;
      });
      // Validate coordinates format
      const validRectCoords = normalizedRectCoords.every(
        (coord) =>
          Array.isArray(coord) &&
          coord.length === 2 &&
          typeof coord[0] === 'number' &&
          typeof coord[1] === 'number' &&
          !isNaN(coord[0]) &&
          !isNaN(coord[1]),
      );
      if (!validRectCoords) {
        console.error('Invalid rectangle coordinates format:', geofence.coordinates);
        return false;
      }
      return isPointInRectangle(pointLat, pointLng, normalizedRectCoords);

    case GeofenceType.POLYGON:
      if (!geofence.coordinates || geofence.coordinates.length < 3) {
        return false;
      }
      // Normalize coordinates (convert strings to numbers if needed)
      const normalizedPolyCoords = geofence.coordinates.map((coord) => {
        if (Array.isArray(coord) && coord.length === 2) {
          return [
            typeof coord[0] === 'string' ? parseFloat(coord[0]) : coord[0],
            typeof coord[1] === 'string' ? parseFloat(coord[1]) : coord[1],
          ];
        }
        return coord;
      });
      // Validate coordinates format
      const validPolyCoords = normalizedPolyCoords.every(
        (coord) =>
          Array.isArray(coord) &&
          coord.length === 2 &&
          typeof coord[0] === 'number' &&
          typeof coord[1] === 'number' &&
          !isNaN(coord[0]) &&
          !isNaN(coord[1]),
      );
      if (!validPolyCoords) {
        console.error('Invalid polygon coordinates format:', geofence.coordinates);
        return false;
      }
      return isPointInPolygon(pointLat, pointLng, normalizedPolyCoords);

    default:
      return false;
  }
}
