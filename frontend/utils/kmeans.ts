// -----------------------------------------------------------------------------
// SMART BUSINESS LOCATION ANALYSIS (No Grid, Road-Snapping, Traffic-Aware)
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
  general_category: string;
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
    opportunity_score?: number;


  };
  zoneType: string;
  analysis: {
    confidence: number;
    opportunity: string;
    opportunity_score?: number;
    competitorCount: number;
  };
}

// -----------------------------------------------------------------------------
// MARKET SATURATION INTERPRETATION
// -----------------------------------------------------------------------------

export interface MarketSaturationStatus {
  percentage: number;
  status: "Good Opportunity" | "Needs Strategic Planning" | "Highly Saturated";
  color: "green" | "yellow" | "red";
  emoji: "🟢" | "🟡" | "🔴";
  explanation: string;
  shortText: string;
}

/**
 * Interpret market saturation value and return user-friendly status
 * @param saturation - Market saturation as decimal (0-1) or percentage (0-100)
 */
export function interpretMarketSaturation(saturation: number): MarketSaturationStatus {
  // Convert to percentage if given as decimal
  const percentage = saturation <= 1 ? Math.round(saturation * 100) : Math.round(saturation);

  if (percentage <= 30) {
    return {
      percentage,
      status: "Good Opportunity",
      color: "green",
      emoji: "🟢",
      explanation: "Competition in this area is relatively low, making it suitable for new business entry with minimal competitive pressure.",
      shortText: "Low competition in this area makes it a good place to start a new business."
    };
  } else if (percentage <= 60) {
    return {
      percentage,
      status: "Needs Strategic Planning",
      color: "yellow",
      emoji: "🟡",
      explanation: "Moderate competition exists in this area. Success depends on differentiation and a clear value proposition.",
      shortText: "Moderate competition — success depends on how you differentiate your business."
    };
  } else {
    return {
      percentage,
      status: "Highly Saturated",
      color: "red",
      emoji: "🔴",
      explanation: "This area has high competition. Entry is risky without a strong competitive advantage or unique offering.",
      shortText: "High competition — consider a different location or strong differentiation strategy."
    };
  }
}

// -----------------------------------------------------------------------------
// COLORS
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
// K-MEANS++ CENTROID INITIALIZATION
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
// TRAFFIC SCORING
// -----------------------------------------------------------------------------

function computeTrafficScore(
  b: Business,
  streetStats: Record<string, number>
): number {
  const key = b.street?.trim().toLowerCase() || "unknown";
  const streetPopularity = streetStats[key] ?? 0;

  return (
    b.business_density_50m * 0.3 +
    b.business_density_100m * 0.2 +
    b.business_density_200m * 0.1 -
    b.competitor_density_50m * 0.25 -
    b.competitor_density_100m * 0.1 -
    b.competitor_density_200m * 0.05 +
    b.zone_encoded * 0.1 +
    streetPopularity * 0.15
  );
}

// -----------------------------------------------------------------------------
// BARANGAY LIMITS
// -----------------------------------------------------------------------------

const BRGY_BOUNDS = {
  minLat: 14.8338,   // South boundary
  maxLat: 14.8413,   // North boundary
  minLng: 120.9518,  // West boundary
  maxLng: 120.9608,  // East boundary
};

function clampToBarangay(lat: number, lng: number) {
  return {
    latitude: Math.min(Math.max(lat, BRGY_BOUNDS.minLat), BRGY_BOUNDS.maxLat),
    longitude: Math.min(Math.max(lng, BRGY_BOUNDS.minLng), BRGY_BOUNDS.maxLng),
  };
}

// -----------------------------------------------------------------------------
// NEW: RANDOMIZATION UTILITIES
// -----------------------------------------------------------------------------

/**
 * Generate a unique run ID for this clustering execution
 */
function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Add controlled jitter to a geographic point
 * @param point Original point
 * @param maxJitterMeters Maximum jitter in meters (default 30m)
 */
function addJitter(point: GeoPoint, maxJitterMeters: number = 30): GeoPoint {
  // Convert meters to approximate degrees (at this latitude ~14.8°N)
  // 1 degree latitude ≈ 111km, 1 degree longitude ≈ 107km at this latitude
  const jitterLatDeg = maxJitterMeters / 111000;
  const jitterLngDeg = maxJitterMeters / 107000;

  return {
    latitude: point.latitude + (Math.random() - 0.5) * 2 * jitterLatDeg,
    longitude: point.longitude + (Math.random() - 0.5) * 2 * jitterLngDeg,
  };
}

/**
 * Fisher-Yates shuffle for randomized selection
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get a random element from array with optional weighting
 */
function weightedRandomSelect<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

// -----------------------------------------------------------------------------
// NEW: GEOGRAPHIC VALIDATION (Polygon-based)
// -----------------------------------------------------------------------------

/**
 * Approximate polygon for Sta. Cruz, Santa Maria, Bulacan
 * More precise than bounding box
 */
const STA_CRUZ_POLYGON: GeoPoint[] = [
  { latitude: 14.8340, longitude: 120.9520 },
  { latitude: 14.8340, longitude: 120.9605 },
  { latitude: 14.8380, longitude: 120.9608 },
  { latitude: 14.8410, longitude: 120.9600 },
  { latitude: 14.8413, longitude: 120.9560 },
  { latitude: 14.8405, longitude: 120.9520 },
  { latitude: 14.8370, longitude: 120.9518 },
];

/**
 * Ray-casting algorithm to check if point is inside polygon
 */
function isPointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  let inside = false;
  const x = point.longitude;
  const y = point.latitude;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Check if a point is in the valid area (inside polygon + near businesses)
 */
function isValidLocation(
  point: GeoPoint,
  businesses: Business[],
  maxDistanceToBusinessKm: number = 0.15 // 150 meters
): boolean {
  // Must be inside barangay bounds
  if (point.latitude < BRGY_BOUNDS.minLat || point.latitude > BRGY_BOUNDS.maxLat ||
    point.longitude < BRGY_BOUNDS.minLng || point.longitude > BRGY_BOUNDS.maxLng) {
    return false;
  }

  // Must be inside the polygon (or close to boundary)
  if (!isPointInPolygon(point, STA_CRUZ_POLYGON)) {
    // Allow points just outside polygon if very close to a business
    const nearestBizDist = Math.min(
      ...businesses.map(b =>
        haversineDistance(point, { latitude: b.latitude, longitude: b.longitude })
      )
    );
    if (nearestBizDist > 0.05) return false; // More than 50m from any business
  }

  // Must be near at least one existing business (proxy for "not in empty field")
  const nearbyBusinessCount = businesses.filter(b =>
    haversineDistance(point, { latitude: b.latitude, longitude: b.longitude }) <= maxDistanceToBusinessKm
  ).length;

  return nearbyBusinessCount >= 1;
}

// -----------------------------------------------------------------------------
// NEW: LOCATION QUALITY SCORING
// -----------------------------------------------------------------------------

interface LocationScore {
  total: number;
  roadProximity: number;
  poiDensity: number;
  competitorPenalty: number;
  zoneBonus: number;
}

/**
 * Compute a quality score for a candidate location
 * Higher score = better location
 */
function computeLocationScore(
  point: GeoPoint,
  businesses: Business[],
  competitors: Business[],
  streetStats: Record<string, number>,
  majorRoads: string[]
): LocationScore {
  // 1. Road Proximity Score (0-25 points)
  // Distance to nearest business on a major road
  const roadBusinesses = businesses.filter(b =>
    majorRoads.includes(b.street?.toLowerCase() || "")
  );

  let roadProximity = 0;
  if (roadBusinesses.length > 0) {
    const nearestRoadBizDist = Math.min(
      ...roadBusinesses.map(b =>
        haversineDistance(point, { latitude: b.latitude, longitude: b.longitude })
      )
    );
    // Score: 25 if on road (0m), 0 if >250m away
    roadProximity = Math.max(0, 25 * (1 - nearestRoadBizDist / 0.25));
  }

  // 2. POI Density Score (0-30 points)
  // Number of businesses within 100m
  const poisWithin100m = businesses.filter(b =>
    haversineDistance(point, { latitude: b.latitude, longitude: b.longitude }) <= 0.1
  ).length;
  // Score: 30 if 10+ businesses, scales down
  const poiDensity = Math.min(30, poisWithin100m * 3);

  // 3. Competitor Penalty (0 to -25 points)
  // Penalty for nearby competitors
  const competitorsWithin100m = competitors.filter(c =>
    haversineDistance(point, { latitude: c.latitude, longitude: c.longitude }) <= 0.1
  ).length;
  const competitorsWithin200m = competitors.filter(c =>
    haversineDistance(point, { latitude: c.latitude, longitude: c.longitude }) <= 0.2
  ).length;
  const competitorPenalty = -(competitorsWithin100m * 8 + competitorsWithin200m * 2);

  // 4. Zone Bonus (0-20 points)
  // Bonus for being in commercial zones
  const nearestBiz = businesses
    .map(b => ({
      business: b,
      distance: haversineDistance(point, { latitude: b.latitude, longitude: b.longitude })
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  let zoneBonus = 0;
  if (nearestBiz && nearestBiz.distance < 0.1) {
    const zoneType = nearestBiz.business.zone_type?.toLowerCase() || "";
    if (zoneType.includes("commercial") || zoneType.includes("business")) {
      zoneBonus = 20;
    } else if (zoneType.includes("mixed") || zoneType.includes("residential")) {
      zoneBonus = 10;
    }
  }

  const total = roadProximity + poiDensity + competitorPenalty + zoneBonus;

  return { total, roadProximity, poiDensity, competitorPenalty, zoneBonus };
}

// -----------------------------------------------------------------------------
// NEW: DYNAMIC CONFIDENCE CALCULATION
// -----------------------------------------------------------------------------

/**
 * Compute dynamic confidence score based on multiple factors
 * Returns value between 0.40 and 0.95
 */
function computeDynamicConfidence(
  recommended: GeoPoint,
  clusterPoints: ClusterPoint[],
  allPoints: Business[],
  competitors: Business[],
  streetStats: Record<string, number>,
  majorRoads: string[]
): number {
  // Factor 1: Cluster cohesion (0-0.25)
  // How tight is the cluster around the recommended point
  const avgDistToRecommended = clusterPoints.reduce((sum, p) =>
    sum + haversineDistance(recommended, { latitude: p.latitude, longitude: p.longitude }), 0
  ) / Math.max(1, clusterPoints.length);
  const cohesionScore = Math.max(0, 0.25 * (1 - avgDistToRecommended / 0.5));

  // Factor 2: Competitor distance (0-0.25)
  // Farther from competitors = higher confidence
  const nearestCompetitorDist = competitors.length > 0
    ? Math.min(...competitors.map(c =>
      haversineDistance(recommended, { latitude: c.latitude, longitude: c.longitude })
    ))
    : 0.5; // If no competitors, assume 500m
  const competitorScore = Math.min(0.25, nearestCompetitorDist * 0.5);

  // Factor 3: Road proximity (0-0.20)
  const roadBusinesses = allPoints.filter(b =>
    majorRoads.includes(b.street?.toLowerCase() || "")
  );
  let roadScore = 0;
  if (roadBusinesses.length > 0) {
    const nearestRoadDist = Math.min(
      ...roadBusinesses.map(b =>
        haversineDistance(recommended, { latitude: b.latitude, longitude: b.longitude })
      )
    );
    roadScore = Math.max(0, 0.20 * (1 - nearestRoadDist / 0.2));
  }

  // Factor 4: POI density (0-0.15)
  const poisWithin100m = allPoints.filter(b =>
    haversineDistance(recommended, { latitude: b.latitude, longitude: b.longitude }) <= 0.1
  ).length;
  const densityScore = Math.min(0.15, poisWithin100m * 0.015);

  // Factor 5: Random variance (±0.05)
  // Adds natural variation between runs
  const randomVariance = (Math.random() - 0.5) * 0.10;

  // Combine all factors
  const baseConfidence = 0.40 + cohesionScore + competitorScore + roadScore + densityScore;
  const finalConfidence = Math.min(0.95, Math.max(0.40, baseConfidence + randomVariance));

  return Number(finalConfidence.toFixed(2));
}

// -----------------------------------------------------------------------------
// NEW: MULTI-CANDIDATE GENERATION & SELECTION
// -----------------------------------------------------------------------------

interface ScoredCandidate {
  point: GeoPoint;
  score: number;
  source: string;
}

/**
 * Generate multiple candidate points for the recommended location
 */
function generateCandidates(
  centroid: GeoPoint,
  clusterPoints: ClusterPoint[],
  businesses: Business[],
  majorRoads: string[],
  count: number = 6
): GeoPoint[] {
  const candidates: GeoPoint[] = [];

  // Candidate 1: Centroid with small jitter
  candidates.push(addJitter(centroid, 20));

  // Candidate 2: Centroid with medium jitter
  candidates.push(addJitter(centroid, 40));

  // Candidate 3-4: Top-scoring cluster points with jitter
  const shuffledPoints = shuffleArray(clusterPoints).slice(0, 2);
  for (const p of shuffledPoints) {
    candidates.push(addJitter({ latitude: p.latitude, longitude: p.longitude }, 15));
  }

  // Candidate 5-6: Nearest businesses on major roads
  const roadBusinesses = businesses
    .filter(b => majorRoads.includes(b.street?.toLowerCase() || ""))
    .filter(b =>
      b.latitude >= BRGY_BOUNDS.minLat && b.latitude <= BRGY_BOUNDS.maxLat &&
      b.longitude >= BRGY_BOUNDS.minLng && b.longitude <= BRGY_BOUNDS.maxLng
    )
    .map(b => ({
      business: b,
      distance: haversineDistance(centroid, { latitude: b.latitude, longitude: b.longitude })
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  // Pick random 2 from top 3 road businesses
  const shuffledRoadBiz = shuffleArray(roadBusinesses).slice(0, 2);
  for (const rb of shuffledRoadBiz) {
    candidates.push(addJitter({
      latitude: rb.business.latitude,
      longitude: rb.business.longitude
    }, 10));
  }

  // Ensure all candidates are clamped to barangay
  return candidates.map(c => clampToBarangay(c.latitude, c.longitude));
}

/**
 * Select the best candidate from generated points
 * Adds randomization to avoid always picking the same one
 */
function selectBestCandidate(
  candidates: GeoPoint[],
  businesses: Business[],
  competitors: Business[],
  streetStats: Record<string, number>,
  majorRoads: string[]
): GeoPoint {
  // Score all candidates
  const scored: ScoredCandidate[] = candidates.map((point, idx) => {
    // Filter out invalid locations
    if (!isValidLocation(point, businesses, 0.2)) {
      return { point, score: -1000, source: `candidate_${idx}` };
    }

    const locationScore = computeLocationScore(
      point, businesses, competitors, streetStats, majorRoads
    );

    // Add small random factor to break ties and add variance
    const randomBonus = Math.random() * 5;

    return {
      point,
      score: locationScore.total + randomBonus,
      source: `candidate_${idx}`
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Pick from top 3 candidates with weighted probability
  const top3 = scored.filter(s => s.score > -500).slice(0, 3);

  if (top3.length === 0) {
    // Fallback to first candidate (clamped centroid)
    return candidates[0];
  }

  if (top3.length === 1) {
    return top3[0].point;
  }

  // Weighted selection: 60% chance best, 30% second, 10% third
  const weights = [0.60, 0.30, 0.10].slice(0, top3.length);
  return weightedRandomSelect(top3.map(t => t.point), weights);
}

// -----------------------------------------------------------------------------
// ELBOW METHOD — AUTOMATIC K SELECTION (K = 2 → 6)
// -----------------------------------------------------------------------------

function computeInertia(points: Business[], k: number): number {
  let centroids = initializeKMeansPlusPlus(points, k);
  let clusters: Cluster[] = [];

  for (let iteration = 0; iteration < 25; iteration++) {
    clusters = Array.from({ length: k }, (_, i) => ({
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

  // inertia = sum of squared distances
  let inertia = 0;
  clusters.forEach((cluster) => {
    cluster.points.forEach((p) => {
      const d = haversineDistance(
        { latitude: p.latitude, longitude: p.longitude },
        cluster.centroid
      );
      inertia += d * d;
    });
  });

  return inertia;
}

function selectOptimalK(points: Business[]): number {
  const Ks = [2, 3, 4, 5, 6];
  const inertias = Ks.map((k) => computeInertia(points, k));

  const deltas = [];
  for (let i = 1; i < inertias.length; i++) {
    deltas.push(inertias[i - 1] - inertias[i]);
  }

  const firstDrop = deltas[0];
  const threshold = firstDrop * 0.25;

  for (let i = 1; i < deltas.length; i++) {
    if (deltas[i] < threshold) {
      return Ks[i]; // elbow found
    }
  }

  return 6; // fallback = max K
}


// -----------------------------------------------------------------------------
// FINAL FUNCTION — findOptimalLocation
// -----------------------------------------------------------------------------

export function findOptimalLocation(
  businesses: Business[],
  category: string
): ClusteringResult {

  // IMPORTANT: User-selected category is CONTEXT ONLY
  // We use ALL businesses from ALL categories for clustering
  const normalizedCategory = category.trim().toLowerCase();

  // Use all businesses for clustering (not filtered by category)
  const points = businesses;

  // Build street popularity map
  const streetStats: Record<string, number> = {};
  for (const b of businesses) {
    const key = b.street?.trim().toLowerCase() || "unknown";
    streetStats[key] = (streetStats[key] || 0) + 1;
  }

  const K = selectOptimalK(points);

  let centroids = initializeKMeansPlusPlus(points, K);
  let clusters: Cluster[] = [];

  // K-MEANS LOOP
  for (let iteration = 0; iteration < 40; iteration++) {
    clusters = Array.from({ length: K }, (_, i) => ({
      id: i,
      color: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
      centroid: centroids[i],
      points: [],
    }));

    // Assign businesses to centroids
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

    // Recompute centroids
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

  // Choose best cluster
  let best = scoredClusters.sort((a, b) => b.score - a.score)[0].cluster;

  // Avoid low-traffic clusters
  const trafficOfBest =
    best.points.reduce(
      (sum, p) => sum + computeTrafficScore(p.business, streetStats),
      0
    ) / best.points.length;

  if (trafficOfBest < 1 && scoredClusters.length > 1) {
    best = scoredClusters[1].cluster;
  }

  // ------------------------------------------------------
  // NEW: MULTI-CANDIDATE GENERATION & SELECTION
  // (Replaces old single-point snapping logic)
  // ------------------------------------------------------

  const threshold = Math.max(
    3,
    Math.floor(
      Object.values(streetStats).reduce((a, b) => a + b, 0) /
      Object.keys(streetStats).length
    )
  );

  const majorRoads = Object.entries(streetStats)
    .filter(([, count]) => count >= threshold)
    .map(([street]) => street.toLowerCase());

  const centroid = best.centroid;

  // Competitors are ONLY businesses in the same category (for context)
  const competitors = businesses.filter(
    (b) => b.general_category.trim().toLowerCase() === normalizedCategory
  );

  // Generate multiple candidate locations
  const candidates = generateCandidates(
    centroid,
    best.points,
    businesses,
    majorRoads,
    6
  );

  // Select best candidate with randomization
  let recommended = selectBestCandidate(
    candidates,
    businesses,
    competitors,
    streetStats,
    majorRoads
  );

  // Ensure final result is clamped inside barangay
  recommended = clampToBarangay(recommended.latitude, recommended.longitude);

  // Validate the location - if invalid, fall back to nearest valid business
  if (!isValidLocation(recommended, businesses, 0.2)) {
    const nearestValid = businesses
      .filter(b =>
        b.latitude >= BRGY_BOUNDS.minLat && b.latitude <= BRGY_BOUNDS.maxLat &&
        b.longitude >= BRGY_BOUNDS.minLng && b.longitude <= BRGY_BOUNDS.maxLng
      )
      .map(b => ({
        point: { latitude: b.latitude, longitude: b.longitude },
        distance: haversineDistance(centroid, { latitude: b.latitude, longitude: b.longitude })
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    if (nearestValid) {
      recommended = addJitter(nearestValid.point, 15);
      recommended = clampToBarangay(recommended.latitude, recommended.longitude);
    }
  }

  // Determine zone type based on nearest business to recommended point
  const closestBizForZone = businesses
    .map((b) => ({
      business: b,
      distance: haversineDistance(recommended, {
        latitude: b.latitude,
        longitude: b.longitude,
      }),
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  const inferredZoneType = closestBizForZone.business.zone_type;

  // --------------------------------------
  // NEARBY BUSINESSES (for UI only, show 10 closest)
  // --------------------------------------
  const nearbyBusinesses = businesses
    .map((b) => ({
      business: b,
      distance: haversineDistance(recommended, {
        latitude: b.latitude,
        longitude: b.longitude,
      }),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10);

  // --------------------------------------
  // COMPETITOR ANALYSIS (same category only)
  // --------------------------------------

  // Pre-compute competitor distances from the recommended point
  const competitorDistances = competitors.map((b) => ({
    business: b,
    distance: haversineDistance(recommended, {
      latitude: b.latitude,
      longitude: b.longitude,
    }),
  }));

  // Total competitors (same category)
  const competitorCount = competitorDistances.length;

  // Nearest competitor
  const sortedCompetitors = [...competitorDistances].sort(
    (a, b) => a.distance - b.distance
  );
  const nearestCompetitorEntry = sortedCompetitors[0] || null;

  const nearestCompetitor = nearestCompetitorEntry
    ? nearestCompetitorEntry.business
    : null;

  const distanceToNearest = nearestCompetitorEntry
    ? nearestCompetitorEntry.distance
    : 0;

  // Competitors within radius ranges (in km)
  const competitorsWithin500m = competitorDistances.filter(
    (c) => c.distance <= 0.5
  ).length;

  const competitorsWithin1km = competitorDistances.filter(
    (c) => c.distance <= 1
  ).length;

  const competitorsWithin2km = competitorDistances.filter(
    (c) => c.distance <= 2
  ).length;

  // Businesses within 1km (all categories) for saturation baseline
  const businessesWithin1km = businesses.filter(
    (b) =>
      haversineDistance(recommended, {
        latitude: b.latitude,
        longitude: b.longitude,
      }) <= 1
  ).length;

  // Market saturation: share of businesses within 1km that are competitors
  const marketSaturation =
    businessesWithin1km > 0 ? competitorsWithin1km / businessesWithin1km : 0;

  // --------------------------------------
  // NEW: 5-FACTOR OPPORTUNITY SCORING
  // Uses all businesses, category is context only
  // --------------------------------------

  // Factor 1: Total Business Count (weight: 0.30)
  const allBusinessesNearby = businesses.filter(b =>
    haversineDistance(recommended, { latitude: b.latitude, longitude: b.longitude }) <= 0.3
  ).length;
  const businessCountScore = Math.min(1, allBusinessesNearby / 30) * 0.30;

  // Factor 2: Category Diversity (weight: 0.25)
  const nearbyCategories = new Set(
    businesses
      .filter(b => haversineDistance(recommended, { latitude: b.latitude, longitude: b.longitude }) <= 0.3)
      .map(b => b.general_category.trim().toLowerCase())
  );
  const diversityScore = Math.min(1, nearbyCategories.size / 6) * 0.25;

  // Factor 3: Market Saturation Balance (weight: 0.20)
  // Avoid single-category dominance
  const categoryCount = new Map<string, number>();
  businesses
    .filter(b => haversineDistance(recommended, { latitude: b.latitude, longitude: b.longitude }) <= 0.3)
    .forEach(b => {
      const cat = b.general_category.trim().toLowerCase();
      categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
    });
  const maxCategoryShare = allBusinessesNearby > 0
    ? Math.max(...Array.from(categoryCount.values())) / allBusinessesNearby
    : 0;
  const saturationBalance = (1 - maxCategoryShare) * 0.20;

  // Factor 4: Zone Compatibility (weight: 0.15)
  const zoneType = inferredZoneType.toLowerCase();
  let zoneCompatibility = 0.05;
  if (zoneType.includes('commercial')) zoneCompatibility = 0.15;
  else if (zoneType.includes('mixed')) zoneCompatibility = 0.10;
  else if (zoneType.includes('residential')) zoneCompatibility = 0.05;

  // Factor 5: Category Context Relevance (weight: 0.10)
  // Small bonus if selected category has room to grow
  const categoryContextScore = competitorsWithin500m <= 2 ? 0.10 :
    competitorsWithin500m <= 5 ? 0.05 : 0.02;

  // Final Opportunity Score (0-100)
  const opportunityScore = Math.round(
    (businessCountScore + diversityScore + saturationBalance + zoneCompatibility + categoryContextScore) * 100
  );

  // Confidence = Final Score
  const confidence = opportunityScore / 100;

  // Generate opportunity label based on new scoring
  let opportunityLabel: string;
  if (opportunityScore >= 85) {
    opportunityLabel = "Highly Recommended";
  } else if (opportunityScore >= 70) {
    opportunityLabel = "Good Choice";
  } else if (opportunityScore >= 55) {
    opportunityLabel = "Fair Option";
  } else {
    opportunityLabel = "Not Recommended";
  }

  const opportunity = `${opportunityLabel} — Based on business density, category diversity, and zone compatibility.`;

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
          : "There is some competition in this area, but new businesses can still succeed with a unique offering.",
    },
    zoneType: inferredZoneType,
    analysis: {
      confidence,
      opportunity,
      competitorCount,
    },
  };
}

export function computeOpportunityScore(metrics: {
  competitorCount: number;
  businessDensity50m: number;
  businessDensity100m: number;
  businessDensity200m: number;
  clusterStrength: number;
}) {
  // Competitor impact (inverse)
  const comp = Math.max(0, Math.min(1, 1 - metrics.competitorCount / 5));

  // Business density weighted more strongly
  const densityRaw =
    metrics.businessDensity50m * 0.5 +
    metrics.businessDensity100m * 0.3 +
    metrics.businessDensity200m * 0.2;

  const density = Math.min(1, densityRaw / 20);

  // Cluster strength (favor strong clusters)
  const cluster = Math.min(1, metrics.clusterStrength / 5);

  // New balanced formula:
  const score =
    comp * 0.45 +   // competition is most important
    density * 0.30 +
    cluster * 0.25;

  return Number(score.toFixed(3));
}



