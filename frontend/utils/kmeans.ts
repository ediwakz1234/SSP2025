// -----------------------------------------------------------------------------
// K-MEANS LOCATION ANALYSIS (Traffic-Based Scoring + Grid Candidates)
// -----------------------------------------------------------------------------

import {
  haversineDistance,
  calculateGeographicCentroid,
  GeoPoint,
} from "./haversine";

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface Business {
  business_id: number;
  business_name: string;
  general_category: string;     // <-- FIXED
  latitude: number;
  longitude: number;
  street: string;
  zone_type: string;
  business_density_50m: number;
  business_density_100m: number;
  business_density_200m: number;
  competitor_density_50m: number;
  competitor_density_100m: number;
  competitor_density_200m: number;
  zone_encoded: number;
  status: string;
}

export interface ClusterPoint {
  latitude: number;
  longitude: number;
  business: Business;
}

export interface Cluster {
  id: number;
  color: string;
  centroid: GeoPoint;
  points: ClusterPoint[];
}

export interface ClusteringResult {
  clusters: Cluster[];
  recommendedLocation: GeoPoint;
  nearbyBusinesses: Array<{ business: Business; distance: number }>;
  competitorAnalysis: {
    competitorCount: number;
    nearestCompetitor: Business | null;
    distanceToNearest: number;
    competitorsWithin500m: number;
    competitorsWithin1km: number;
    competitorsWithin2km: number;
    marketSaturation: number;
    recommendedStrategy: string;
  };
  zoneType: string;
  analysis: {
    confidence: number;
    opportunity: string;
    competitorCount: number;
  };
}

// -----------------------------------------------------------------------------
// CONSTANTS
// -----------------------------------------------------------------------------

const CLUSTER_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#06B6D4", "#F97316", "#84CC16",
];

// -----------------------------------------------------------------------------
// FIX EMPTY CLUSTERS
// -----------------------------------------------------------------------------

function fixEmptyClusters(clusters: Cluster[], points: Business[]): void {
  clusters.forEach((cluster) => {
    if (cluster.points.length === 0) {
      const fallback = points[Math.floor(Math.random() * points.length)];
      cluster.points.push({
        latitude: fallback.latitude,
        longitude: fallback.longitude,
        business: fallback,
      });
    }
  });
}

// -----------------------------------------------------------------------------
// K-MEANS++ INITIALIZATION
// -----------------------------------------------------------------------------

function initializeKMeansPlusPlus(points: Business[], k: number): GeoPoint[] {
  const centroids: Business[] = [];
  centroids.push(points[Math.floor(Math.random() * points.length)]);

  while (centroids.length < k) {
    const distances = points.map((p) => {
      const minD = Math.min(
        ...centroids.map((c) =>
          haversineDistance(
            { latitude: p.latitude, longitude: p.longitude },
            { latitude: c.latitude, longitude: c.longitude }
          )
        )
      );
      return minD * minD;
    });

    const sum = distances.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;

    for (let i = 0; i < distances.length; i++) {
      r -= distances[i];
      if (r <= 0) {
        centroids.push(points[i]);
        break;
      }
    }
  }

  return centroids.map((c) => ({
    latitude: c.latitude,
    longitude: c.longitude,
  }));
}

// -----------------------------------------------------------------------------
// TRAFFIC + STREET POPULARITY SCORE
// -----------------------------------------------------------------------------

function computeTrafficScore(
  b: Business,
  streetStats: Record<string, number>
): number {
  const key = b.street?.trim().toLowerCase() || "unknown";
  const streetPopularity = streetStats[key] ?? 0;

  return (
    b.business_density_50m * 0.30 +
    b.business_density_100m * 0.20 +
    b.business_density_200m * 0.10 -
    b.competitor_density_50m * 0.25 -
    b.competitor_density_100m * 0.10 -
    b.competitor_density_200m * 0.05 +
    b.zone_encoded * 0.10 +
    streetPopularity * 0.15
  );
}

// -----------------------------------------------------------------------------
// ⭐ Generate grid candidate points
// -----------------------------------------------------------------------------

function generateCandidateGrid(cluster: Cluster, spacingMeters = 40): GeoPoint[] {
  const LAT_METER = 0.000009;
  const LNG_METER = 0.000009;

  const latitudes = cluster.points.map((p) => p.latitude);
  const longitudes = cluster.points.map((p) => p.longitude);

  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  const grid: GeoPoint[] = [];
  const latStep = LAT_METER * spacingMeters;
  const lngStep = LNG_METER * spacingMeters;

  for (let lat = minLat; lat <= maxLat; lat += latStep) {
    for (let lng = minLng; lng <= maxLng; lng += lngStep) {
      grid.push({ latitude: lat, longitude: lng });
    }
  }

  return grid;
}

// -----------------------------------------------------------------------------
// ⭐ Score a candidate grid point
// -----------------------------------------------------------------------------

function scoreCandidatePoint(
  p: GeoPoint,
  allBusinesses: Business[],
  streetStats: Record<string, number>,
  category: string
): number {
  let businessDensity50 = 0;
  let businessDensity100 = 0;
  let businessDensity200 = 0;

  let competitorDensity50 = 0;
  let competitorDensity100 = 0;
  let competitorDensity200 = 0;

  for (const b of allBusinesses) {
    const dist = haversineDistance(p, { latitude: b.latitude, longitude: b.longitude });

    if (dist <= 0.05) businessDensity50++;
    if (dist <= 0.1) businessDensity100++;
    if (dist <= 0.2) businessDensity200++;

    if (b.general_category.trim().toLowerCase() === category.trim().toLowerCase()) {
      if (dist <= 0.05) competitorDensity50++;
      if (dist <= 0.1) competitorDensity100++;
      if (dist <= 0.2) competitorDensity200++;
    }
  }

  const nearest = allBusinesses
    .map((b) => ({
      street: b.street,
      dist: haversineDistance(p, { latitude: b.latitude, longitude: b.longitude }),
    }))
    .sort((a, b) => a.dist - b.dist)[0];

  const streetKey = nearest.street?.trim().toLowerCase() || "unknown";
  const streetPopularity = streetStats[streetKey] ?? 0;

  return (
    businessDensity50 * 0.30 +
    businessDensity100 * 0.20 +
    businessDensity200 * 0.10 -
    competitorDensity50 * 0.25 -
    competitorDensity100 * 0.10 -
    competitorDensity200 * 0.05 +
    streetPopularity * 0.15 +
    0.05
  );
}

// -----------------------------------------------------------------------------
// ⭐ MAIN — findOptimalLocation
// -----------------------------------------------------------------------------

export function findOptimalLocation(
  businesses: Business[],
  category: string
): ClusteringResult {
  
  const normalized = category.trim().toLowerCase();

  // FIXED — category → general_category
  const filtered = businesses.filter(
    (b) => b.general_category.trim().toLowerCase() === normalized
  );

  const points = filtered.length ? filtered : businesses;

  // Street popularity map
  const streetStats: Record<string, number> = {};
  for (const b of businesses) {
    const key = b.street?.trim().toLowerCase() || "unknown";
    streetStats[key] = (streetStats[key] || 0) + 1;
  }

  // Determine K
  let K = 2;
  if (points.length > 20) K = 3;
  if (points.length > 40) K = 4;
  if (points.length > 80) K = 5;
  if (points.length > 150) K = 6;
  if (points.length > 250) K = 7;

  let centroids = initializeKMeansPlusPlus(points, K);
  let clusters: Cluster[] = [];

  // ITERATE
  for (let iteration = 0; iteration < 40; iteration++) {
    clusters = Array.from({ length: K }, (_, i) => ({
      id: i,
      color: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
      centroid: centroids[i],
      points: [],
    }));

    for (const b of points) {
      let bestIdx = 0;
      let bestDist = Infinity;

      centroids.forEach((c, idx) => {
        const d = haversineDistance(
          { latitude: b.latitude, longitude: b.longitude },
          c
        );
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      });

      clusters[bestIdx].points.push({
        latitude: b.latitude,
        longitude: b.longitude,
        business: b,
      });
    }

    fixEmptyClusters(clusters, points);

    const newCentroids = clusters.map((cluster) =>
      calculateGeographicCentroid(
        cluster.points.map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
        }))
      )
    );

    if (JSON.stringify(newCentroids) === JSON.stringify(centroids)) break;

    centroids = newCentroids;
  }

  // Score clusters
  const scoredClusters = clusters.map((cluster) => {
    const avgScore =
      cluster.points.reduce(
        (sum, p) => sum + computeTrafficScore(p.business, streetStats),
        0
      ) / cluster.points.length;

    return { cluster, score: avgScore };
  });

  const best = scoredClusters.sort((a, b) => b.score - a.score)[0].cluster;

  // Candidate grid scoring
  const grid = generateCandidateGrid(best, 40);
  const scoredGrid = grid.map((p) => ({
    point: p,
    score: scoreCandidatePoint(p, businesses, streetStats, category),
  }));

  const bestCandidate = scoredGrid.sort((a, b) => b.score - a.score)[0];
  const recommended = bestCandidate.point;

  // Nearby businesses
  const nearbyBusinesses = points
    .map((b) => ({
      business: b,
      distance: haversineDistance(
        recommended,
        { latitude: b.latitude, longitude: b.longitude }
      ),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10);

  // Competitor analysis
  const competitorCount = filtered.length;
  const nearestCompetitor = nearbyBusinesses[1]?.business ?? null;
  const distanceToNearest = nearbyBusinesses[1]?.distance ?? 0;

  const competitorsWithin500m = nearbyBusinesses.filter(
    (p) => p.distance <= 0.5
  ).length;
  const competitorsWithin1km = nearbyBusinesses.filter(
    (p) => p.distance <= 1
  ).length;
  const competitorsWithin2km = nearbyBusinesses.filter(
    (p) => p.distance <= 2
  ).length;

  const marketSaturation = competitorCount / points.length;

  const confidence =
    best.points.length / points.length >= 0.45
      ? 0.82
      : best.points.length / points.length >= 0.25
      ? 0.68
      : 0.55;

  const opportunity =
    confidence >= 0.8
      ? "EXCELLENT OPPORTUNITY — High foot-traffic indicators and healthy market space."
      : confidence >= 0.6
      ? "GOOD OPPORTUNITY — Balanced customer reach with moderate competition."
      : "CAUTION — Competition density is high relative to surroundings.";

  return {
    clusters,
    recommendedLocation: recommended,
    nearbyBusinesses,
    competitorAnalysis: {
      competitorCount,
      nearestCompetitor,
      distanceToNearest,
      competitorsWithin500m,
      competitorsWithin1km,
      competitorsWithin2km,
      marketSaturation,
      recommendedStrategy:
        confidence >= 0.8
          ? "Ideal location for business entry."
          : "Proceed with clear differentiation.",
    },
    zoneType:
      best.points[0]?.business.zone_type ||
      "Unknown",
    analysis: {
      confidence,
      opportunity,
      competitorCount,
    },
  };
}
