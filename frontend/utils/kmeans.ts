// K-Means Clustering Algorithm Implementation with Haversine Distance
import { Business } from "../data/businesses";
import { haversineDistance, calculateGeographicCentroid, calculateDensityWithinRadius } from "./haversine";

export interface ClusterPoint {
    latitude: number;
    longitude: number;
    business?: Business;
}

export interface Cluster {
    id: number;
    centroid: ClusterPoint;
    points: ClusterPoint[];
    color: string;
}

export interface CompetitorAnalysis {
    nearestCompetitor: Business | null;
    distanceToNearest: number;
    competitorsWithin500m: number;
    competitorsWithin1km: number;
    competitorsWithin2km: number;
    marketSaturation: number; // 0-1 scale
    recommendedStrategy: string;
}

export interface ClusteringResult {
    clusters: Cluster[];
    iterations: number;
    recommendedLocation: ClusterPoint;
    analysis: {
        totalBusinesses: number;
        competitorCount: number;
        opportunity: string;
        confidence: number;
    };
    competitorAnalysis: CompetitorAnalysis;
    zoneType: string;
    nearbyBusinesses: Array<{
        business: Business;
        distance: number;
    }>;
}

// Initialize random centroids
function initializeCentroids(points: ClusterPoint[], k: number): ClusterPoint[] {
    const centroids: ClusterPoint[] = [];
    const usedIndices = new Set<number>();

    while (centroids.length < k) {
        const randomIndex = Math.floor(Math.random() * points.length);
        if (!usedIndices.has(randomIndex)) {
            usedIndices.add(randomIndex);
            centroids.push({ ...points[randomIndex] });
        }
    }

    return centroids;
}

// Assign points to nearest centroid using Haversine distance
function assignPointsToClusters(points: ClusterPoint[], centroids: ClusterPoint[]): Cluster[] {
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

    const clusters: Cluster[] = centroids.map((centroid, i) => ({
        id: i,
        centroid: { ...centroid },
        points: [],
        color: colors[i % colors.length]
    }));

    points.forEach(point => {
        let minDistance = Infinity;
        let closestCluster = 0;

        centroids.forEach((centroid, i) => {
            const distance = haversineDistance(point, centroid);
            if (distance < minDistance) {
                minDistance = distance;
                closestCluster = i;
            }
        });

        clusters[closestCluster].points.push(point);
    });

    return clusters;
}

// Recalculate centroids based on cluster points using geographic centroid
function recalculateCentroids(clusters: Cluster[]): ClusterPoint[] {
    return clusters.map(cluster => {
        if (cluster.points.length === 0) {
            return cluster.centroid;
        }

        // Use geographic centroid for better accuracy
        return calculateGeographicCentroid(cluster.points);
    });
}

// Check if centroids have converged using Haversine distance
function hasConverged(oldCentroids: ClusterPoint[], newCentroids: ClusterPoint[], thresholdKm = 0.01): boolean {
    return oldCentroids.every((old, i) => {
        const distance = haversineDistance(old, newCentroids[i]);
        return distance < thresholdKm; // 10 meters threshold
    });
}

// Main K-Means clustering function
export function performKMeansClustering(
    businesses: Business[],
    k: number = 3,
    maxIterations: number = 100
): Cluster[] {
    // Convert businesses to cluster points
    const points: ClusterPoint[] = businesses.map(b => ({
        latitude: b.latitude,
        longitude: b.longitude,
        business: b
    }));

    // Initialize centroids
    let centroids = initializeCentroids(points, k);
    let clusters: Cluster[] = [];
    let iterations = 0;

    // Iterate until convergence or max iterations
    for (let i = 0; i < maxIterations; i++) {
        iterations++;

        // Assign points to clusters
        clusters = assignPointsToClusters(points, centroids);

        // Recalculate centroids
        const newCentroids = recalculateCentroids(clusters);

        // Check for convergence
        if (hasConverged(centroids, newCentroids)) {
            break;
        }

        centroids = newCentroids;
    }

    // Update cluster centroids
    clusters.forEach((cluster, i) => {
        cluster.centroid = centroids[i];
    });

    return clusters;
}

// Perform detailed competitor analysis
function performCompetitorAnalysis(
    location: ClusterPoint,
    businesses: Business[],
    businessCategory: string
): CompetitorAnalysis {
    const competitors = businesses.filter(
        b => b.category.toLowerCase() === businessCategory.toLowerCase()
    );

    if (competitors.length === 0) {
        return {
            nearestCompetitor: null,
            distanceToNearest: Infinity,
            competitorsWithin500m: 0,
            competitorsWithin1km: 0,
            competitorsWithin2km: 0,
            marketSaturation: 0,
            recommendedStrategy: "FIRST MOVER: No competitors detected. Excellent opportunity to establish market presence and brand recognition.",
        };
    }

    // Find nearest competitor
    let nearestCompetitor = competitors[0];
    let minDistance = haversineDistance(location, {
        latitude: competitors[0].latitude,
        longitude: competitors[0].longitude,
    });

    competitors.forEach(comp => {
        const distance = haversineDistance(location, {
            latitude: comp.latitude,
            longitude: comp.longitude,
        });
        if (distance < minDistance) {
            minDistance = distance;
            nearestCompetitor = comp;
        }
    });

    // Count competitors within different radii
    const competitorsWithin500m = calculateDensityWithinRadius(
        location,
        competitors.map(c => ({ latitude: c.latitude, longitude: c.longitude })),
        0.5
    );

    const competitorsWithin1km = calculateDensityWithinRadius(
        location,
        competitors.map(c => ({ latitude: c.latitude, longitude: c.longitude })),
        1.0
    );

    const competitorsWithin2km = calculateDensityWithinRadius(
        location,
        competitors.map(c => ({ latitude: c.latitude, longitude: c.longitude })),
        2.0
    );

    // Calculate market saturation (0-1 scale)
    const maxCompetitorsExpected = 10; // Threshold for saturation
    const marketSaturation = Math.min(competitorsWithin1km / maxCompetitorsExpected, 1);

    // Generate strategy recommendation
    let recommendedStrategy = "";
    if (competitorsWithin500m === 0) {
        recommendedStrategy = "LOW COMPETITION: No immediate competitors. Focus on quality service and building customer loyalty.";
    } else if (competitorsWithin500m <= 2) {
        recommendedStrategy = "MODERATE COMPETITION: Differentiate through unique value proposition, better pricing, or superior service.";
    } else if (competitorsWithin500m <= 5) {
        recommendedStrategy = "HIGH COMPETITION: Require strong differentiation strategy. Consider niche specialization or unique selling points.";
    } else {
        recommendedStrategy = "SATURATED MARKET: Very high competition. Success requires exceptional differentiation or consider alternative location.";
    }

    return {
        nearestCompetitor,
        distanceToNearest: minDistance,
        competitorsWithin500m,
        competitorsWithin1km,
        competitorsWithin2km,
        marketSaturation,
        recommendedStrategy,
    };
}

// Find optimal location for new business with enhanced analysis
export function findOptimalLocation(
    businesses: Business[],
    businessCategory: string,
    k: number = 5
): ClusteringResult {
    // Filter competitors (same category)
    const competitors = businesses.filter(
        b => b.category.toLowerCase() === businessCategory.toLowerCase()
    );

    // Perform clustering
    const clusters = performKMeansClustering(businesses, k);

    // Find cluster with lowest competition density using Haversine distance
    const clusterAnalysis = clusters.map(cluster => {
        const competitorCount = cluster.points.filter(
            p => p.business?.category.toLowerCase() === businessCategory.toLowerCase()
        ).length;

        // Calculate area density using Haversine
        const avgDistance = cluster.points.length > 0
            ? cluster.points.reduce((sum, p) => sum + haversineDistance(cluster.centroid, p), 0) / cluster.points.length
            : 0;

        const density = cluster.points.length / (Math.PI * Math.pow(Math.max(avgDistance, 0.1), 2));
        const competitorDensity = competitorCount / Math.max(cluster.points.length, 1);

        // Score based on: low competition + reasonable business density + zone preference
        const commercialBonus = cluster.points.filter(p => p.business?.zone_type === "Commercial").length / Math.max(cluster.points.length, 1);
        const score = (1 - competitorDensity) * 0.5 + (density * 0.3) + (commercialBonus * 0.2);

        return {
            cluster,
            competitorCount,
            density,
            competitorDensity,
            commercialBonus,
            score
        };
    });

    // Sort by score (descending)
    clusterAnalysis.sort((a, b) => b.score - a.score);

    const bestCluster = clusterAnalysis[0];
    const recommendedLocation = bestCluster.cluster.centroid;

    // Perform detailed competitor analysis
    const competitorAnalysis = performCompetitorAnalysis(
        recommendedLocation,
        businesses,
        businessCategory
    );

    // Determine zone type for recommended location
    const nearbyBusinesses = businesses
        .map(b => ({
            business: b,
            distance: haversineDistance(recommendedLocation, {
                latitude: b.latitude,
                longitude: b.longitude,
            }),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10);

    const commercialCount = nearbyBusinesses.filter(
        nb => nb.business.zone_type === "Commercial"
    ).length;
    const zoneType = commercialCount >= 5 ? "Commercial" : "Residential";

    // Generate opportunity analysis
    let opportunity = "";
    let confidence = 0;

    if (competitorAnalysis.competitorsWithin500m === 0) {
        opportunity = "HIGH OPPORTUNITY: No direct competitors within 500m radius. Ideal location for market entry with first-mover advantage.";
        confidence = 0.92;
    } else if (competitorAnalysis.competitorsWithin1km <= 2) {
        opportunity = "MODERATE-HIGH OPPORTUNITY: Low competition density within 1km. Good potential for market share with proper execution.";
        confidence = 0.78;
    } else if (competitorAnalysis.competitorsWithin1km <= 5) {
        opportunity = "MODERATE OPPORTUNITY: Moderate competition present. Success depends on differentiation and service quality.";
        confidence = 0.62;
    } else {
        opportunity = "CHALLENGING MARKET: High competition density. Requires strong differentiation strategy or consider alternative location.";
        confidence = 0.45;
    }

    return {
        clusters,
        iterations: k,
        recommendedLocation,
        analysis: {
            totalBusinesses: businesses.length,
            competitorCount: competitors.length,
            opportunity,
            confidence
        },
        competitorAnalysis,
        zoneType,
        nearbyBusinesses
    };
}

// Calculate business density in a radius using Haversine distance
export function calculateDensity(
    center: ClusterPoint,
    businesses: Business[],
    radiusKm: number = 0.5
): number {
    return calculateDensityWithinRadius(
        center,
        businesses.map(b => ({ latitude: b.latitude, longitude: b.longitude })),
        radiusKm
    );
}
