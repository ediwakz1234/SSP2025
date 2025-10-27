// Haversine Distance Formula for accurate geographical distance calculation
// Returns distance in kilometers

export interface GeoPoint {
    latitude: number;
    longitude: number;
}

const EARTH_RADIUS_KM = 6371; // Earth's radius in kilometers

/**
 * Calculate the Haversine distance between two geographical points
 * @param point1 First geographical point
 * @param point2 Second geographical point
 * @returns Distance in kilometers
 */
export function haversineDistance(point1: GeoPoint, point2: GeoPoint): number {
    const lat1Rad = toRadians(point1.latitude);
    const lat2Rad = toRadians(point2.latitude);
    const deltaLatRad = toRadians(point2.latitude - point1.latitude);
    const deltaLonRad = toRadians(point2.longitude - point1.longitude);

    const a =
        Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
        Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(deltaLonRad / 2) *
        Math.sin(deltaLonRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = EARTH_RADIUS_KM * c;

    return distance;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
function toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
}

/**
 * Calculate density within a radius using Haversine distance
 * @param center Center point
 * @param points Array of points to check
 * @param radiusKm Radius in kilometers
 * @returns Number of points within the radius
 */
export function calculateDensityWithinRadius(
    center: GeoPoint,
    points: GeoPoint[],
    radiusKm: number
): number {
    return points.filter(point => {
        const distance = haversineDistance(center, point);
        return distance <= radiusKm;
    }).length;
}

/**
 * Find the nearest point to a given location
 * @param location Target location
 * @param points Array of points to search
 * @returns Object with nearest point and distance in km
 */
export function findNearestPoint(
    location: GeoPoint,
    points: GeoPoint[]
): { point: GeoPoint; distance: number } | null {
    if (points.length === 0) return null;

    let nearestPoint = points[0];
    let minDistance = haversineDistance(location, points[0]);

    for (let i = 1; i < points.length; i++) {
        const distance = haversineDistance(location, points[i]);
        if (distance < minDistance) {
            minDistance = distance;
            nearestPoint = points[i];
        }
    }

    return {
        point: nearestPoint,
        distance: minDistance,
    };
}

/**
 * Calculate the centroid of multiple geographical points
 * Using spherical geometry for accuracy
 */
export function calculateGeographicCentroid(points: GeoPoint[]): GeoPoint {
    if (points.length === 0) {
        throw new Error("Cannot calculate centroid of empty array");
    }

    if (points.length === 1) {
        return points[0];
    }

    // Convert to Cartesian coordinates
    let x = 0, y = 0, z = 0;

    for (const point of points) {
        const latRad = toRadians(point.latitude);
        const lonRad = toRadians(point.longitude);

        x += Math.cos(latRad) * Math.cos(lonRad);
        y += Math.cos(latRad) * Math.sin(lonRad);
        z += Math.sin(latRad);
    }

    const total = points.length;
    x /= total;
    y /= total;
    z /= total;

    // Convert back to latitude/longitude
    const centralLongitude = Math.atan2(y, x);
    const centralSquareRoot = Math.sqrt(x * x + y * y);
    const centralLatitude = Math.atan2(z, centralSquareRoot);

    return {
        latitude: toDegrees(centralLatitude),
        longitude: toDegrees(centralLongitude),
    };
}

/**
 * Get all points within a radius sorted by distance
 */
export function getPointsWithinRadius(
    center: GeoPoint,
    points: GeoPoint[],
    radiusKm: number
): Array<{ point: GeoPoint; distance: number }> {
    return points
        .map(point => ({
            point,
            distance: haversineDistance(center, point),
        }))
        .filter(item => item.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance);
}
