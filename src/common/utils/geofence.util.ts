

import { Geofence, GeofenceType } from '../../entities/geofence.entity';

const GEOFENCE_MARGIN_METERS = 20;


function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; 
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


function distanceToLineSegment(
  pointLat: number,
  pointLng: number,
  lineLat1: number,
  lineLng1: number,
  lineLat2: number,
  lineLng2: number,
): number {
  
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

  
  return calculateDistance(pointLat, pointLng, closestLat, closestLng);
}


function isPointInPolygon(
  pointLat: number,
  pointLng: number,
  coordinates: number[][],
): boolean {
  if (!coordinates || coordinates.length < 3) {
    return false;
  }

  
  let inside = false;
  for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
    const [latI, lngI] = coordinates[i]; 
    const [latJ, lngJ] = coordinates[j]; 

  
    const edgeCrossesHorizontalLine = (latI > pointLat) !== (latJ > pointLat);
    
    if (edgeCrossesHorizontalLine) {
      
      const intersectionLng = lngI + (lngJ - lngI) * (pointLat - latI) / (latJ - latI);
      
    
      if (intersectionLng > pointLng) {
        inside = !inside;
      }
    }
  }

  
  if (inside) {
    return true;
  }

  
  for (let i = 0; i < coordinates.length; i++) {
    const [lat1, lng1] = coordinates[i];
    const [lat2, lng2] = coordinates[(i + 1) % coordinates.length];
    
    
    const distanceToEdge = distanceToLineSegment(
      pointLat, pointLng,
      lat1, lng1,
      lat2, lng2
    );
    
    if (distanceToEdge <= GEOFENCE_MARGIN_METERS) {
      return true; 
    }
  }

  return false;
}


function isPointInRectangle(
  pointLat: number,
  pointLng: number,
  coordinates: number[][],
): boolean {
  if (!coordinates || coordinates.length < 4) {
    return false;
  }

  
  const lats = coordinates.map((coord) => coord[0]);
  const lngs = coordinates.map((coord) => coord[1]);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);


  const latMargin = GEOFENCE_MARGIN_METERS / 111000; 
  const avgLat = (minLat + maxLat) / 2;
  const lngMargin = GEOFENCE_MARGIN_METERS / (111000 * Math.cos(toRadians(avgLat)));

  return (
    pointLat >= (minLat - latMargin) &&
    pointLat <= (maxLat + latMargin) &&
    pointLng >= (minLng - lngMargin) &&
    pointLng <= (maxLng + lngMargin)
  );
}


function isPointInCircle(
  pointLat: number,
  pointLng: number,
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
): boolean {
  const distance = calculateDistance(pointLat, pointLng, centerLat, centerLng);

  return distance <= (radiusMeters + GEOFENCE_MARGIN_METERS);
}


/**
 * Result of checking if a point is within a geofence
 */
export interface GeofenceCheckResult {
  isWithin: boolean;
  isNearBoundary: boolean;
}

/**
 * Calculate minimum distance from a point to a polygon boundary
 */
function distanceToPolygonBoundary(
  pointLat: number,
  pointLng: number,
  coordinates: number[][],
): number {
  if (!coordinates || coordinates.length < 3) {
    return Infinity;
  }

  // Check if point is inside
  let inside = false;
  for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
    const [latI, lngI] = coordinates[i];
    const [latJ, lngJ] = coordinates[j];
    const edgeCrossesHorizontalLine = (latI > pointLat) !== (latJ > pointLat);
    if (edgeCrossesHorizontalLine) {
      const intersectionLng = lngI + (lngJ - lngI) * (pointLat - latI) / (latJ - latI);
      if (intersectionLng > pointLng) {
        inside = !inside;
      }
    }
  }

  if (inside) {
    // Point is inside, find distance to nearest edge
    let minDistance = Infinity;
    for (let i = 0; i < coordinates.length; i++) {
      const [lat1, lng1] = coordinates[i];
      const [lat2, lng2] = coordinates[(i + 1) % coordinates.length];
      const distanceToEdge = distanceToLineSegment(pointLat, pointLng, lat1, lng1, lat2, lng2);
      minDistance = Math.min(minDistance, distanceToEdge);
    }
    return minDistance;
  } else {
    // Point is outside, find distance to nearest vertex or edge
    let minDistance = Infinity;
    for (let i = 0; i < coordinates.length; i++) {
      const [lat1, lng1] = coordinates[i];
      const [lat2, lng2] = coordinates[(i + 1) % coordinates.length];
      const distanceToEdge = distanceToLineSegment(pointLat, pointLng, lat1, lng1, lat2, lng2);
      const distanceToVertex = calculateDistance(pointLat, pointLng, lat1, lng1);
      minDistance = Math.min(minDistance, distanceToEdge, distanceToVertex);
    }
    return minDistance;
  }
}

/**
 * Calculate minimum distance from a point to a rectangle boundary
 */
function distanceToRectangleBoundary(
  pointLat: number,
  pointLng: number,
  coordinates: number[][],
): number {
  if (!coordinates || coordinates.length < 4) {
    return Infinity;
  }

  const lats = coordinates.map((coord) => coord[0]);
  const lngs = coordinates.map((coord) => coord[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Check if point is inside
  const isInside = pointLat >= minLat && pointLat <= maxLat && pointLng >= minLng && pointLng <= maxLng;

  if (isInside) {
    // Point is inside, find distance to nearest edge
    const distToTop = maxLat - pointLat;
    const distToBottom = pointLat - minLat;
    const distToRight = maxLng - pointLng;
    const distToLeft = pointLng - minLng;
    return Math.min(distToTop, distToBottom, distToRight, distToLeft) * 111000; // Convert to meters
  } else {
    // Point is outside, find distance to nearest edge or corner
    let minDistance = Infinity;
    for (let i = 0; i < coordinates.length; i++) {
      const [lat1, lng1] = coordinates[i];
      const [lat2, lng2] = coordinates[(i + 1) % coordinates.length];
      const distanceToEdge = distanceToLineSegment(pointLat, pointLng, lat1, lng1, lat2, lng2);
      const distanceToVertex = calculateDistance(pointLat, pointLng, lat1, lng1);
      minDistance = Math.min(minDistance, distanceToEdge, distanceToVertex);
    }
    return minDistance;
  }
}

/**
 * Check if a point is within a geofence, considering threshold distance if enabled.
 * Returns both whether the point is within the strict boundary and whether it's near the boundary.
 */
export function checkPointWithinGeofence(
  pointLat: number,
  pointLng: number,
  geofence: Geofence,
): GeofenceCheckResult {
  const geofenceLat = parseFloat(geofence.latitude);
  const geofenceLng = parseFloat(geofence.longitude);

  if (isNaN(geofenceLat) || isNaN(geofenceLng)) {
    console.error(
      `Invalid geofence coordinates: lat=${geofence.latitude}, lng=${geofence.longitude}`,
    );
    return { isWithin: false, isNearBoundary: false };
  }

  // First check if point is strictly within geofence
  const isStrictlyWithin = isPointWithinGeofence(pointLat, pointLng, geofence);

  // If threshold is not enabled, return strict check result
  if (!geofence.threshold_enabled || !geofence.threshold_distance) {
    return { isWithin: isStrictlyWithin, isNearBoundary: false };
  }

  const thresholdMeters = parseFloat(geofence.threshold_distance);
  if (isNaN(thresholdMeters) || thresholdMeters <= 0) {
    return { isWithin: isStrictlyWithin, isNearBoundary: false };
  }

  // If already strictly within, not near boundary
  if (isStrictlyWithin) {
    return { isWithin: true, isNearBoundary: false };
  }

  // Calculate distance to boundary
  let distanceToBoundary: number;

  if (!geofence.type) {
    // Legacy: default circle with 100m radius
    const distance = calculateDistance(pointLat, pointLng, geofenceLat, geofenceLng);
    distanceToBoundary = Math.abs(distance - 100);
  } else {
    switch (geofence.type) {
      case GeofenceType.CIRCLE:
        if (!geofence.radius) {
          return { isWithin: false, isNearBoundary: false };
        }
        const radiusMeters = parseFloat(geofence.radius);
        if (isNaN(radiusMeters)) {
          return { isWithin: false, isNearBoundary: false };
        }
        const distance = calculateDistance(pointLat, pointLng, geofenceLat, geofenceLng);
        distanceToBoundary = Math.abs(distance - radiusMeters);
        break;

      case GeofenceType.RECTANGLE:
        if (!geofence.coordinates || geofence.coordinates.length < 4) {
          return { isWithin: false, isNearBoundary: false };
        }
        const normalizedRectCoords = geofence.coordinates.map((coord) => {
          if (Array.isArray(coord) && coord.length === 2) {
            return [
              typeof coord[0] === 'string' ? parseFloat(coord[0]) : coord[0],
              typeof coord[1] === 'string' ? parseFloat(coord[1]) : coord[1],
            ];
          }
          return coord;
        });
        distanceToBoundary = distanceToRectangleBoundary(pointLat, pointLng, normalizedRectCoords);
        break;

      case GeofenceType.POLYGON:
        if (!geofence.coordinates || geofence.coordinates.length < 3) {
          return { isWithin: false, isNearBoundary: false };
        }
        const normalizedPolyCoords = geofence.coordinates.map((coord) => {
          if (Array.isArray(coord) && coord.length === 2) {
            return [
              typeof coord[0] === 'string' ? parseFloat(coord[0]) : coord[0],
              typeof coord[1] === 'string' ? parseFloat(coord[1]) : coord[1],
            ];
          }
          return coord;
        });
        distanceToBoundary = distanceToPolygonBoundary(pointLat, pointLng, normalizedPolyCoords);
        break;

      default:
        return { isWithin: false, isNearBoundary: false };
    }
  }

  // Check if within threshold
  const isWithinThreshold = distanceToBoundary <= thresholdMeters;

  return {
    isWithin: isStrictlyWithin || isWithinThreshold,
    isNearBoundary: !isStrictlyWithin && isWithinThreshold,
  };
}

export function isPointWithinGeofence(
  pointLat: number,
  pointLng: number,
  geofence: Geofence,
): boolean {
  
  const geofenceLat = parseFloat(geofence.latitude);
  const geofenceLng = parseFloat(geofence.longitude);

  
  if (isNaN(geofenceLat) || isNaN(geofenceLng)) {
    console.error(
      `Invalid geofence coordinates: lat=${geofence.latitude}, lng=${geofence.longitude}`,
    );
    return false;
  }

  
  if (!geofence.type) {
    
    const distance = calculateDistance(
      pointLat,
      pointLng,
      geofenceLat,
      geofenceLng,
    );
    return distance <= (100 + GEOFENCE_MARGIN_METERS); 
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
      
      const normalizedRectCoords = geofence.coordinates.map((coord) => {
        if (Array.isArray(coord) && coord.length === 2) {
          return [
            typeof coord[0] === 'string' ? parseFloat(coord[0]) : coord[0],
            typeof coord[1] === 'string' ? parseFloat(coord[1]) : coord[1],
          ];
        }
        return coord;
      });
      
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
      
      const normalizedPolyCoords = geofence.coordinates.map((coord) => {
        if (Array.isArray(coord) && coord.length === 2) {
          return [
            typeof coord[0] === 'string' ? parseFloat(coord[0]) : coord[0],
            typeof coord[1] === 'string' ? parseFloat(coord[1]) : coord[1],
          ];
        }
        return coord;
      });
    
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
