import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { haversineDistance } from "../../utils/haversine";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Progress } from "../ui/progress";
import { useActivity, logActivity } from "../../utils/activity";
import {
  Activity,
  FileDown,
  FileText,
  FileType,
  Lightbulb,
  MapPin,
  Store,
  TrendingDown,
  Zap,
  Clock,
  Target,
  Rocket,
  Users,
  BarChart3,
  Sun,
  Moon,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  TrendingUp,
} from "lucide-react";


import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { RefreshCw, AlertCircle } from "lucide-react";
import { useKMeansStore } from "../../lib/stores/kmeansStore";

// New imports for enhanced features
import {
  determineBestZone,
  evaluateZoneSuitability,
} from "../../utils/zoneAnalysis";
import { InsightsPanel, generateInsightsPanelData } from "./InsightsPanel";
import { ZoneAnalysis } from "./ZoneAnalysis";
import { RecommendedForYou } from "./RecommendedForYou";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface Opportunity {
  title: string;
  category: string;
  location: string;
  businessDensity: number;
  competitors: number;
  zone_type: string;
  saturation: number;
  score: number;
  cluster?: number;
  coordinates: {
    lat: number;
    lng: number;
  };
  insights: string[];
}

interface ClusteringRow {
  business_category: string;
  num_clusters: number | null;
  locations: LocationData[];
}

interface LocationData {
  street: string;
  general_category: string;
  zone_type: string;
  business_density_200m: number;
  competitor_density_200m: number;
  latitude: number;
  longitude: number;
  cluster?: number;
}

interface BusinessRow {
  id: number;
  business_name: string;
  latitude: number;
  longitude: number;
  street: string;
  zone_type: string;
  status: string;
  business_density_200m: number;
  competitor_density_200m: number;
  general_category: string;
}

interface CategoryStat {
  category: string;
  count: number;
  avgBusinessDensity: number;
  avgCompetitors: number;
}

interface ZoneStat {
  zone: string;
  count: number;
}

type GapLevel = "High" | "Medium" | "Low";

interface MarketGap {
  category: string;
  demand: number;
  supply: number;
  gapScore: number;
  gapLevel: GapLevel;
  recommendedLocations: string[];
  timeGap?: string;
  suggestion?: string;
}

// Business opportunity with enhanced scoring
interface BusinessOpportunity {
  name: string;
  category: string;
  score: number;
  status: "Strong" | "Good" | "Moderate";
  operatingTime: "Day" | "Evening" | "Both";
  setupSpeed: "Fast" | "Moderate" | "Slow";
  competitionLevel: "Low" | "Medium" | "High";
  description?: string;
}

// User Preferences for personalized scoring
interface UserPreferences {
  businessType: string;
  radiusRange: number; // in meters (0-2000)
  budgetMin: number;
  budgetMax: number;
  startupCapital: number;
  competitorTolerance: "Low" | "Medium" | "High";
  customerPriority: number; // 0-100
}

const DEFAULT_PREFERENCES: UserPreferences = {
  businessType: "",
  radiusRange: 1000,
  budgetMin: 10000,
  budgetMax: 50000,
  startupCapital: 100000,
  competitorTolerance: "Medium",
  customerPriority: 50,
};

// Normalize value to 0-1 range
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

// Determine operating time based on business category and zone
function determineOperatingTime(category: string, zoneType: string): "Day" | "Evening" | "Both" {
  const cat = (category || "").toLowerCase();
  const zone = (zoneType || "").toLowerCase();

  // Evening-focused businesses
  if (cat.includes("entertainment") || cat.includes("bar") || cat.includes("nightlife")) {
    return "Evening";
  }
  // Day-focused businesses
  if (cat.includes("office") || cat.includes("service") || cat.includes("bank")) {
    return "Day";
  }
  // Both - restaurants, retail, food
  if (cat.includes("restaurant") || cat.includes("food") || cat.includes("retail")) {
    return "Both";
  }
  // Zone-based determination
  if (zone.includes("commercial")) return "Both";
  if (zone.includes("residential")) return "Day";
  return "Both";
}

// Determine setup speed based on business type
function determineSetupSpeed(category: string): "Fast" | "Moderate" | "Slow" {
  const cat = (category || "").toLowerCase();

  // Fast setup businesses
  if (cat.includes("retail") || cat.includes("trading") || cat.includes("merchandise")) {
    return "Fast";
  }
  // Slow setup businesses
  if (cat.includes("restaurant") || cat.includes("manufacturing") || cat.includes("clinic")) {
    return "Slow";
  }
  return "Moderate";
}

// Calculate comprehensive opportunity score
function calculateOpportunityScore(
  density: number,
  competitors: number,
  zoneType: string,
  confidence?: number
): number {
  let score = 50; // Base score

  // Zone bonus
  const zone = (zoneType || "").toLowerCase();
  if (zone.includes("commercial")) score += 20;
  else if (zone.includes("mixed")) score += 10;
  else if (zone.includes("residential")) score += 5;

  // Density bonus (higher density = more foot traffic)
  if (density >= 15) score += 15;
  else if (density >= 8) score += 10;
  else if (density >= 3) score += 5;

  // Competition penalty (inverse relationship)
  if (competitors === 0) score += 15;
  else if (competitors <= 2) score += 10;
  else if (competitors <= 5) score += 0;
  else score -= 10;

  // Confidence bonus
  if (confidence && confidence > 0.7) score += 10;
  else if (confidence && confidence > 0.5) score += 5;

  return Math.min(100, Math.max(0, score));
}

// Get status label from score
function getStatusFromScore(score: number): "Strong" | "Good" | "Moderate" {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Good";
  return "Moderate";
}

// Get competition level from competitor count
function getCompetitionLevel(competitors: number): "Low" | "Medium" | "High" {
  if (competitors <= 2) return "Low";
  if (competitors <= 5) return "Medium";
  return "High";
}

// Calculate predictive score for each opportunity based on user preferences
function calculatePredictiveScore(
  loc: LocationData,
  preferences: UserPreferences,
  allLocations: LocationData[]
): number {
  // Find min/max for normalization
  const densities = allLocations.map(l => l.business_density_200m);
  const competitors = allLocations.map(l => l.competitor_density_200m);
  const minDensity = Math.min(...densities);
  const maxDensity = Math.max(...densities);
  const minCompetitors = Math.min(...competitors);
  const maxCompetitors = Math.max(...competitors);

  // 1. Density Score (higher density = higher foot traffic = better)
  const densityScore = normalize(loc.business_density_200m, minDensity, maxDensity);

  // 2. Competition Score (lower = better, so invert)
  const rawCompetitionScore = normalize(loc.competitor_density_200m, minCompetitors, maxCompetitors);
  let competitionScore = 1 - rawCompetitionScore;

  // Adjust based on competitor tolerance
  if (preferences.competitorTolerance === "Low" && rawCompetitionScore > 0.3) {
    competitionScore *= 0.5; // Penalize high competition
  } else if (preferences.competitorTolerance === "High") {
    competitionScore = 0.5 + competitionScore * 0.5; // Be lenient
  }

  // 3. Zone Score (Commercial > Mixed > Residential)
  let zoneScore = 0.5;
  const zone = loc.zone_type?.toLowerCase() || "";
  if (zone === "commercial") {
    zoneScore = 1.0;
  } else if (zone === "mixed") {
    zoneScore = 0.7;
  } else if (zone === "residential") {
    zoneScore = 0.4;
  }

  // 4. Business Match Score (category match)
  let businessMatchScore = 0.5;
  if (preferences.businessType) {
    const userBusiness = preferences.businessType.toLowerCase();
    const locCategory = (loc.general_category || "").toLowerCase();
    if (locCategory.includes(userBusiness) || userBusiness.includes(locCategory)) {
      businessMatchScore = 1.0;
    } else if (
      (userBusiness.includes("food") && locCategory.includes("restaurant")) ||
      (userBusiness.includes("restaurant") && locCategory.includes("food"))
    ) {
      businessMatchScore = 0.9;
    }
  }

  // 5. Customer Priority Score (high density areas preferred when high priority)
  const customerScore = (preferences.customerPriority / 100) * densityScore +
    ((100 - preferences.customerPriority) / 100) * competitionScore;

  // 6. Capital/Budget Score (estimate based on zone type)
  const estimatedRent = zoneScore === 1.0 ? 35000 : zoneScore === 0.7 ? 25000 : 15000;
  const budgetMatch = estimatedRent >= preferences.budgetMin && estimatedRent <= preferences.budgetMax;
  const budgetScore = budgetMatch ? 1.0 : 0.4;

  // Calculate weighted predictive score
  const predictiveScore =
    (0.25 * densityScore) +
    (0.25 * competitionScore) +
    (0.20 * zoneScore) +
    (0.15 * customerScore) +
    (0.15 * budgetScore * businessMatchScore);

  // Add some variance based on location features
  const variance = (loc.latitude % 0.001) * 10; // Small variance from coordinates

  return Math.round((predictiveScore + variance * 0.05) * 100);
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

function computeSaturation(businessDensity: number, competitors: number) {
  return Math.min(
    Math.round((competitors / (businessDensity + 1)) * 100),
    100
  );
}

function computeOpportunityScore(
  businessDensity: number,
  competitors: number,
  zone: string
) {
  const zoneWeight =
    zone?.toLowerCase() === "commercial"
      ? 20
      : zone?.toLowerCase() === "mixed"
        ? 10
        : 5;

  return Math.min(
    Math.round(
      businessDensity * 2 + (1 / (competitors + 1)) * 40 + zoneWeight
    ),
    100
  );
}

function generateInsights(loc: {
  businessDensity: number;
  competitors: number;
  zone_type: string;
}): string[] {
  const insights: string[] = [];

  if (loc.competitors === 0) {
    insights.push("No direct competitors within 200m.");
  }

  if (loc.businessDensity > 20) {
    insights.push("Located in a high-business activity zone.");
  }

  if (loc.businessDensity < 8) {
    insights.push("Low business presence — great for first movers.");
  }

  if (loc.competitors > 8) {
    insights.push("High competition — consider differentiation.");
  }

  insights.push(`Zone type: ${loc.zone_type}`);

  return insights;
}

// -----------------------------------------------------------------------------
// K-means Cluster-Based KPI Calculations
// -----------------------------------------------------------------------------

interface ClusterStats {
  clusterId: number;
  locationCount: number;
  avgDensity: number;
  avgCompetition: number;
  commercialCount: number;
  residentialCount: number;
  mixedCount: number;
  opportunityScore: number;
  centerLat: number;
  centerLng: number;
  categories: Map<string, number>;
}

interface ClusterKPIs {
  totalOpportunities: number;
  numClusters: number;
  avgBusinessDensity: number;
  avgCompetition: number;
  commercialZoneCount: number;
  residentialZoneCount: number;
  clusterStats: ClusterStats[];
  categoryDistribution: { name: string; count: number }[];
  bestCluster: ClusterStats | null;
  lowestCompetitionCluster: ClusterStats | null;
  highestDensityCluster: ClusterStats | null;
}

// Helper: Compute dynamic density for a location based on all other locations
function computeDynamicDensity(loc: LocationData, allLocations: LocationData[], radiusKm: number = 0.2): {
  businessDensity: number;
  competitorDensity: number;
} {
  const point = { latitude: loc.latitude, longitude: loc.longitude };

  // Count all businesses within radius
  const businessDensity = allLocations.filter(other => {
    const otherPoint = { latitude: other.latitude, longitude: other.longitude };
    return haversineDistance(point, otherPoint) <= radiusKm;
  }).length;

  // Count competitors (same category) within radius
  const competitorDensity = allLocations.filter(other => {
    if (other.general_category !== loc.general_category) return false;
    const otherPoint = { latitude: other.latitude, longitude: other.longitude };
    return haversineDistance(point, otherPoint) <= radiusKm;
  }).length;

  return { businessDensity, competitorDensity };
}

function calculateClusterKPIs(locations: LocationData[], numClusters: number): ClusterKPIs {
  if (locations.length === 0) {
    return {
      totalOpportunities: 0,
      numClusters: 0,
      avgBusinessDensity: 0,
      avgCompetition: 0,
      commercialZoneCount: 0,
      residentialZoneCount: 0,
      clusterStats: [],
      categoryDistribution: [],
      bestCluster: null,
      lowestCompetitionCluster: null,
      highestDensityCluster: null,
    };
  }

  // Pre-compute dynamic densities for all locations (if stored values are 0)
  const locationsWithDensity = locations.map(loc => {
    // If stored density is 0 or undefined, compute it dynamically
    if (!loc.business_density_200m && !loc.competitor_density_200m) {
      const { businessDensity, competitorDensity } = computeDynamicDensity(loc, locations, 0.2);
      return {
        ...loc,
        business_density_200m: businessDensity,
        competitor_density_200m: competitorDensity,
      };
    }
    return loc;
  });

  // Group locations by cluster (use enhanced locations with computed density)
  const clusterMap = new Map<number, LocationData[]>();
  locationsWithDensity.forEach(loc => {
    const cluster = loc.cluster || 0;
    if (!clusterMap.has(cluster)) clusterMap.set(cluster, []);
    clusterMap.get(cluster)!.push(loc);
  });

  // Calculate per-cluster statistics
  const clusterStats: ClusterStats[] = [];
  clusterMap.forEach((points, clusterId) => {
    const avgDensity = points.reduce((s, p) => s + (p.business_density_200m || 0), 0) / points.length;
    const avgCompetition = points.reduce((s, p) => s + (p.competitor_density_200m || 0), 0) / points.length;

    // Zone counts
    const commercialCount = points.filter(p => p.zone_type?.toLowerCase() === 'commercial').length;
    const residentialCount = points.filter(p => p.zone_type?.toLowerCase() === 'residential').length;
    const mixedCount = points.filter(p => p.zone_type?.toLowerCase() === 'mixed').length;

    // Centroid (average of all point coordinates)
    const centerLat = points.reduce((s, p) => s + (p.latitude || 0), 0) / points.length;
    const centerLng = points.reduce((s, p) => s + (p.longitude || 0), 0) / points.length;

    // Category distribution within cluster
    const categories = new Map<string, number>();
    points.forEach(p => {
      const cat = p.general_category || 'Unknown';
      categories.set(cat, (categories.get(cat) || 0) + 1);
    });

    // Opportunity score: high density + low competition = high score
    const opportunityScore = avgDensity / (avgCompetition + 1) * 10;

    clusterStats.push({
      clusterId,
      locationCount: points.length,
      avgDensity: Math.round(avgDensity),
      avgCompetition: Math.round(avgCompetition * 10) / 10,
      commercialCount,
      residentialCount,
      mixedCount,
      opportunityScore: Math.round(opportunityScore * 10) / 10,
      centerLat,
      centerLng,
      categories,
    });
  });

  // Sort clusters by opportunity score
  clusterStats.sort((a, b) => b.opportunityScore - a.opportunityScore);

  // Overall averages (use enhanced locations with computed density)
  const totalOpportunities = locationsWithDensity.length;
  const avgBusinessDensity = Math.round(
    locationsWithDensity.reduce((s, loc) => s + (loc.business_density_200m || 0), 0) / locationsWithDensity.length
  );
  const avgCompetition = Math.round(
    locationsWithDensity.reduce((s, loc) => s + (loc.competitor_density_200m || 0), 0) / locationsWithDensity.length * 10
  ) / 10;

  // Zone counts
  const commercialZoneCount = locationsWithDensity.filter(loc =>
    loc.zone_type?.toLowerCase() === 'commercial'
  ).length;
  const residentialZoneCount = locationsWithDensity.filter(loc =>
    loc.zone_type?.toLowerCase() === 'residential'
  ).length;

  // Category distribution across all clusters
  const catMap = new Map<string, number>();
  locationsWithDensity.forEach(loc => {
    const cat = loc.general_category || 'Unknown';
    catMap.set(cat, (catMap.get(cat) || 0) + 1);
  });
  const categoryDistribution = Array.from(catMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Find best clusters
  const bestCluster = clusterStats[0] || null;
  const lowestCompetitionCluster = [...clusterStats].sort((a, b) => a.avgCompetition - b.avgCompetition)[0] || null;
  const highestDensityCluster = [...clusterStats].sort((a, b) => b.avgDensity - a.avgDensity)[0] || null;

  return {
    totalOpportunities,
    numClusters: clusterStats.length,
    avgBusinessDensity,
    avgCompetition,
    commercialZoneCount,
    residentialZoneCount,
    clusterStats,
    categoryDistribution,
    bestCluster,
    lowestCompetitionCluster,
    highestDensityCluster,
  };
}

// Generate auto-insights from K-means cluster analysis with REAL DATA
function generateClusterInsights(kpis: ClusterKPIs, locations: LocationData[]): string[] {
  const insights: string[] = [];

  if (kpis.totalOpportunities === 0) {
    return ["No clustering data available. Run a clustering analysis first."];
  }

  // 1. TOP CATEGORY - using categoryDistribution from kpis
  if (kpis.categoryDistribution.length > 0) {
    const topCat = kpis.categoryDistribution[0];
    insights.push(`Top category: ${topCat.name} — ${topCat.count} businesses detected (highest presence in the area)`);
  }

  // 2. LOWEST COMPETITION CLUSTER - with street name
  if (kpis.lowestCompetitionCluster) {
    // Find a representative street from this cluster's locations
    const clusterLocations = locations.filter(loc => loc.cluster === kpis.lowestCompetitionCluster?.clusterId);
    const streetName = clusterLocations[0]?.street || `Cluster ${kpis.lowestCompetitionCluster.clusterId}`;
    const competitorCount = kpis.lowestCompetitionCluster.avgCompetition;

    if (competitorCount === 0) {
      insights.push(`Lowest competition: Near ${streetName} — no direct competitors (ideal for first movers)`);
    } else {
      insights.push(`Lowest competition: Near ${streetName} — only ${competitorCount} competitor${competitorCount > 1 ? 's' : ''} nearby`);
    }
  }

  // 3. AVERAGE BUSINESS DENSITY
  if (kpis.avgBusinessDensity > 0) {
    insights.push(`Average business density: ${kpis.avgBusinessDensity} nearby businesses across opportunity clusters`);
  }

  // 4. BEST CLUSTER with opportunity score
  if (kpis.bestCluster) {
    const bestLocs = locations.filter(loc => loc.cluster === kpis.bestCluster?.clusterId);
    const bestStreet = bestLocs[0]?.street || `Zone ${kpis.bestCluster.clusterId}`;
    insights.push(`Best opportunity: Near ${bestStreet} — Score ${kpis.bestCluster.opportunityScore} (${kpis.bestCluster.locationCount} locations)`);
  }

  // 5. COMMERCIAL VS RESIDENTIAL ZONE DISTRIBUTION
  const commercialPct = kpis.totalOpportunities > 0
    ? Math.round((kpis.commercialZoneCount / kpis.totalOpportunities) * 100)
    : 0;
  const residentialPct = kpis.totalOpportunities > 0
    ? Math.round((kpis.residentialZoneCount / kpis.totalOpportunities) * 100)
    : 0;

  if (commercialPct > 50) {
    insights.push(`Zone analysis: ${commercialPct}% commercial zones — high foot traffic areas dominate`);
  } else if (residentialPct > 50) {
    insights.push(`Zone analysis: ${residentialPct}% residential zones — community-focused businesses recommended`);
  } else {
    insights.push(`Zone analysis: Balanced mix — ${commercialPct}% commercial, ${residentialPct}% residential`);
  }

  // 6. HIGHEST DENSITY CLUSTER
  if (kpis.highestDensityCluster && kpis.highestDensityCluster.avgDensity > 0) {
    const denseLocs = locations.filter(loc => loc.cluster === kpis.highestDensityCluster?.clusterId);
    const denseStreet = denseLocs[0]?.street || `Cluster ${kpis.highestDensityCluster.clusterId}`;
    insights.push(`Highest activity: Near ${denseStreet} — ${kpis.highestDensityCluster.avgDensity} businesses nearby (high traffic zone)`);
  }

  // 7. CATEGORY DIVERSITY check
  if (kpis.categoryDistribution.length >= 3) {
    const top3 = kpis.categoryDistribution.slice(0, 3).map(c => c.name).join(", ");
    insights.push(`Category diversity: Top 3 are ${top3}`);
  } else if (kpis.categoryDistribution.length > 0) {
    insights.push(`Market gap detected: Limited category diversity — opportunity to introduce new business types`);
  }

  return insights.slice(0, 6); // Limit to top 6 insights
}

function buildCategoryStats(businesses: BusinessRow[]): CategoryStat[] {
  const map = new Map<
    string,
    { count: number; totalDensity: number; totalCompetitors: number }
  >();

  businesses.forEach((b) => {
    const key = b.general_category || "Uncategorized";
    const prev = map.get(key) ?? {
      count: 0,
      totalDensity: 0,
      totalCompetitors: 0,
    };

    map.set(key, {
      count: prev.count + 1,
      totalDensity: prev.totalDensity + (b.business_density_200m || 0),
      totalCompetitors:
        prev.totalCompetitors + (b.competitor_density_200m || 0),
    });
  });

  const stats: CategoryStat[] = [];

  map.forEach((value, key) => {
    stats.push({
      category: key,
      count: value.count,
      avgBusinessDensity:
        value.count > 0 ? Math.round(value.totalDensity / value.count) : 0,
      avgCompetitors:
        value.count > 0 ? Math.round(value.totalCompetitors / value.count) : 0,
    });
  });

  // Sort by count desc
  stats.sort((a, b) => b.count - a.count);

  return stats;
}

function buildZoneStats(businesses: BusinessRow[]): ZoneStat[] {
  const map = new Map<string, number>();

  businesses.forEach((b) => {
    const key = b.zone_type || "Unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  });

  const stats: ZoneStat[] = [];
  map.forEach((value, key) => {
    stats.push({ zone: key, count: value });
  });

  return stats;
}

function classifyGapLevel(gapScore: number): GapLevel {
  if (gapScore >= 15) return "High";
  if (gapScore >= 5) return "Medium";
  return "Low";
}

function buildMarketGaps(
  businesses: BusinessRow[],
  opportunities: Opportunity[]
): MarketGap[] {
  const map = new Map<
    string,
    { totalDemand: number; totalSupply: number; count: number; zones: string[] }
  >();

  businesses.forEach((b) => {
    const key = b.general_category || "Uncategorized";
    const prev = map.get(key) ?? {
      totalDemand: 0,
      totalSupply: 0,
      count: 0,
      zones: [],
    };

    map.set(key, {
      totalDemand: prev.totalDemand + (b.business_density_200m || 0),
      totalSupply: prev.totalSupply + (b.competitor_density_200m || 0),
      count: prev.count + 1,
      zones: [...prev.zones, b.zone_type || "Unknown"],
    });
  });

  const gaps: MarketGap[] = [];

  map.forEach((value, key) => {
    if (value.count === 0) return;

    const demand = Math.round(value.totalDemand / value.count);
    const supply = Math.round(value.totalSupply / value.count);
    const gapScore = demand - supply;

    // recommended locations = opportunity streets of this category
    const recLocations = Array.from(
      new Set(
        opportunities
          .filter((o) => o.category === key)
          .map((o) => o.location)
      )
    ).slice(0, 3);

    // Determine time-based gap
    const cat = key.toLowerCase();
    let timeGap: string | undefined;
    let suggestion: string | undefined;

    if (cat.includes("restaurant") || cat.includes("food")) {
      if (supply < 3) {
        timeGap = "Evening dining options are limited";
        suggestion = "Consider opening a restaurant that serves dinner and late-night customers";
      }
    } else if (cat.includes("service")) {
      if (supply < 2) {
        timeGap = "Daytime service businesses are scarce";
        suggestion = "A service-oriented business during daytime hours could fill this gap";
      }
    } else if (cat.includes("retail")) {
      if (gapScore > 5) {
        timeGap = "Limited shopping options for residents";
        suggestion = "A retail store offering daily essentials could serve the local community well";
      }
    }

    if (!suggestion && gapScore >= 10) {
      suggestion = `This category has limited presence - there's a first-mover opportunity for ${key.toLowerCase()} businesses`;
    } else if (!suggestion && gapScore >= 5) {
      suggestion = `Consider a differentiated offering in the ${key.toLowerCase()} space`;
    }

    gaps.push({
      category: key,
      demand,
      supply,
      gapScore,
      gapLevel: classifyGapLevel(gapScore),
      recommendedLocations: recLocations,
      timeGap,
      suggestion,
    });
  });

  // Sort by gapScore desc (bigger gap = more underserved)
  gaps.sort((a, b) => b.gapScore - a.gapScore);

  return gaps;
}

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export function OpportunitiesPage() {
  useActivity();
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation state from ClusteringPage
  const navigationState = location.state as {
    fromClustering?: boolean;
    selectedCategory?: string;
    businessIdea?: string;
    clusterCount?: number;
    zoneType?: string;
  } | null;

  const [clusteringResults, setClusteringResults] =
    useState<ClusteringRow | null>(null);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState("overview");
  const [showAll, setShowAll] = useState(false);
  const [openExportModal, setOpenExportModal] = useState(false);
  const [_showExportModal, setShowExportModal] = useState(false);

  // Preferences state
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [appliedPreferences, setAppliedPreferences] = useState<UserPreferences | null>(null);

  // Load clustering result and active businesses
  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query - if coming from ClusteringPage with a category, filter by it
      let clusterQuery = supabase
        .from("clustering_opportunities")
        .select("*")
        .order("created_at", { ascending: false });

      // Filter by category if passed from ClusteringPage
      if (navigationState?.fromClustering && navigationState?.selectedCategory) {
        clusterQuery = clusterQuery.eq("business_category", navigationState.selectedCategory);
      }

      const [clusterRes, bizRes] = await Promise.all([
        clusterQuery.limit(1).single(),
        supabase
          .from("businesses")
          .select("*")
          .eq("status", "Active"),
      ]);

      // Handle clustering results - don't crash on missing data
      if (clusterRes.error) {
        console.log("No clustering opportunities found:", clusterRes.error.message);
        // This is expected if no clustering has been done yet
        setClusteringResults(null);
      } else if (clusterRes.data) {
        setClusteringResults(clusterRes.data as ClusteringRow);
      }

      if (!bizRes.error && bizRes.data) {
        setBusinesses(bizRes.data as BusinessRow[]);
      }
    } catch (err) {
      console.error("Error loading opportunities data:", err);
      setError("Failed to load opportunities. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [navigationState?.fromClustering, navigationState?.selectedCategory]);

  // ============================================================================
  // ALL MEMOIZED VALUES - MUST BE BEFORE EARLY RETURNS
  // ============================================================================

  // Extract safe values from clustering results
  const businessType = clusteringResults?.business_category || "";
  const numClusters = clusteringResults?.num_clusters ?? 0;
  const locations = clusteringResults?.locations || [];

  // Build opportunities array with predictive scoring
  const opportunities: Opportunity[] = useMemo(() => {
    if (!locations || locations.length === 0) return [];

    const activePrefs = appliedPreferences || DEFAULT_PREFERENCES;

    return locations.map((loc: LocationData): Opportunity => {
      const businessDensity: number = loc.business_density_200m || 0;
      const competitors: number = loc.competitor_density_200m || 0;

      // Use predictive score when preferences are applied
      const score = appliedPreferences
        ? calculatePredictiveScore(loc, activePrefs, locations)
        : computeOpportunityScore(businessDensity, competitors, loc.zone_type || "Mixed");

      return {
        title: `${businessType || "Business"} near ${loc.street || "Unknown"}`,
        category: loc.general_category || "",
        location: loc.street || "Unknown",
        businessDensity,
        competitors,
        zone_type: loc.zone_type || "Mixed",
        saturation: computeSaturation(businessDensity, competitors),
        score,
        cluster: loc.cluster,
        coordinates: {
          lat: loc.latitude || 0,
          lng: loc.longitude || 0,
        },
        insights: generateInsights({
          businessDensity,
          competitors,
          zone_type: loc.zone_type || "Mixed",
        }),
      };
    })
      // Sort by score descending (best opportunities first)
      .sort((a, b) => b.score - a.score);
  }, [locations, businessType, appliedPreferences]);

  // Compute aggregate zone analysis for all opportunities
  const aggregateZoneAnalysis = useMemo(() => {
    if (opportunities.length === 0) {
      return {
        bestZone: "Mixed" as const,
        score: 0,
        reasoning: ["No opportunities available for analysis"],
        competitionLevel: "Low" as const,
        marketDemand: "Low" as const,
        accessibility: "Moderate" as const,
      };
    }
    const avgDensity = opportunities.reduce((sum, op) => sum + op.businessDensity, 0) / opportunities.length;
    const avgCompetitors = opportunities.reduce((sum, op) => sum + op.competitors, 0) / opportunities.length;
    const primaryZone = opportunities[0]?.zone_type || "Mixed";

    return determineBestZone(avgDensity, avgCompetitors, primaryZone, businessType);
  }, [opportunities, businessType]);

  const aggregateSuitability = useMemo(() => {
    if (opportunities.length === 0) {
      return {
        suitability: "Both" as const,
        residentialScore: 50,
        commercialScore: 50,
        explanation: "No opportunities available for suitability analysis.",
      };
    }
    const avgDensity = opportunities.reduce((sum, op) => sum + op.businessDensity, 0) / opportunities.length;
    const avgCompetitors = opportunities.reduce((sum, op) => sum + op.competitors, 0) / opportunities.length;

    return evaluateZoneSuitability(businessType, avgDensity, avgCompetitors);
  }, [opportunities, businessType]);

  // Generate aggregate insights panel data
  const aggregateInsights = useMemo(() => {
    if (opportunities.length === 0) {
      return {
        risks: ["No opportunities data available"],
        advantages: [],
        marketConsiderations: [],
        strategies: [],
        zoneGuidance: [],
      };
    }
    const avgDensity = opportunities.reduce((sum, op) => sum + op.businessDensity, 0) / opportunities.length;
    const avgCompetitors = opportunities.reduce((sum, op) => sum + op.competitors, 0) / opportunities.length;
    const avgScore = opportunities.reduce((sum, op) => sum + op.score, 0) / opportunities.length;
    const primaryZone = opportunities[0]?.zone_type || "Mixed";

    return generateInsightsPanelData(businessType, primaryZone, avgDensity, avgCompetitors, avgScore);
  }, [opportunities, businessType]);

  // K-means cluster-based KPIs (derived from raw location data)
  const clusterKPIs = useMemo(() =>
    calculateClusterKPIs(locations, numClusters),
    [locations, numClusters]
  );

  // Auto-generated cluster insights with REAL DATA
  const clusterInsights = useMemo(() =>
    generateClusterInsights(clusterKPIs, locations),
    [clusterKPIs, locations]
  );

  const categoryStats = useMemo(() => buildCategoryStats(businesses), [businesses]);
  const zoneStats = useMemo(() => buildZoneStats(businesses), [businesses]);
  const totalBusinesses = businesses.length;
  const marketGaps = useMemo(() => buildMarketGaps(businesses, opportunities), [businesses, opportunities]);

  // Get kmeans store data for AI recommendations
  const kmeansStore = useKMeansStore();
  const aiRecommendations = kmeansStore.aiRecommendations;

  // Compute overall opportunity summary for Overview tab
  const overviewSummary = useMemo(() => {
    const avgScore = opportunities.length > 0
      ? Math.round(opportunities.reduce((s, o) => s + o.score, 0) / opportunities.length)
      : 0;

    const avgDensity = clusterKPIs.avgBusinessDensity;
    const avgComp = clusterKPIs.avgCompetition;

    // Determine best operating time from zone and category analysis
    let operatingTime: "Day" | "Evening" | "Both" = "Both";
    const commercialRatio = clusterKPIs.commercialZoneCount / Math.max(1, clusterKPIs.totalOpportunities);
    const residentialRatio = clusterKPIs.residentialZoneCount / Math.max(1, clusterKPIs.totalOpportunities);
    if (commercialRatio > 0.7) operatingTime = "Both";
    else if (residentialRatio > 0.6) operatingTime = "Day";
    else if (commercialRatio > 0.4 && residentialRatio < 0.3) operatingTime = "Evening";

    // Determine setup speed based on category
    const setupSpeed = determineSetupSpeed(businessType);

    // Determine competition level
    const competitionLevel = getCompetitionLevel(avgComp);

    // Determine opportunity focus based on operating time and setup speed
    let opportunityFocus = "Best for quick setup";
    if (operatingTime === "Evening" && competitionLevel === "Low") {
      opportunityFocus = "Best for evening sales";
    } else if (operatingTime === "Day" && competitionLevel === "Low") {
      opportunityFocus = "Best for daytime services";
    } else if (setupSpeed === "Fast" && competitionLevel === "Low") {
      opportunityFocus = "Best for quick setup";
    } else if (avgDensity > 15) {
      opportunityFocus = "Best for high-traffic areas";
    } else if (competitionLevel === "Low") {
      opportunityFocus = "Best for first movers";
    }

    // Determine area readiness level
    let areaReadiness: "High" | "Medium" | "Low" = "Medium";
    if (avgScore >= 70 && commercialRatio > 0.4) {
      areaReadiness = "High";
    } else if (avgScore < 50 || commercialRatio < 0.2) {
      areaReadiness = "Low";
    }

    return {
      category: businessType || "General Business",
      overallScore: avgScore,
      operatingTime,
      setupSpeed,
      competitionLevel,
      status: getStatusFromScore(avgScore),
      opportunityFocus,
      areaReadiness,
    };
  }, [opportunities, clusterKPIs, businessType]);

  // Group opportunities by category for the Opportunities tab
  const opportunitiesByCategory = useMemo(() => {
    const categories = new Map<string, BusinessOpportunity[]>();

    // Add AI top businesses if available
    if (aiRecommendations?.topBusinesses) {
      aiRecommendations.topBusinesses.forEach((biz) => {
        const cat = businessType || "General";
        if (!categories.has(cat)) categories.set(cat, []);

        const score = biz.score || biz.fitPercentage || 70;
        categories.get(cat)!.push({
          name: biz.name,
          category: cat,
          score,
          status: getStatusFromScore(score),
          operatingTime: determineOperatingTime(biz.name, ""),
          setupSpeed: determineSetupSpeed(biz.name),
          competitionLevel: biz.opportunityLevel?.includes("High") ? "Low" :
            biz.opportunityLevel?.includes("Low") ? "High" : "Medium",
          description: biz.shortDescription || biz.fullDetails,
        });
      });
    }

    // Add opportunities from clustering results
    opportunities.forEach((op) => {
      const cat = op.category || "General";
      if (!categories.has(cat)) categories.set(cat, []);

      categories.get(cat)!.push({
        name: op.title,
        category: cat,
        score: op.score,
        status: getStatusFromScore(op.score),
        operatingTime: determineOperatingTime(cat, op.zone_type),
        setupSpeed: determineSetupSpeed(cat),
        competitionLevel: getCompetitionLevel(op.competitors),
        description: op.insights[0],
      });
    });

    // Sort each category by score
    categories.forEach((opps, cat) => {
      opps.sort((a, b) => b.score - a.score);
      categories.set(cat, opps.slice(0, 10)); // Limit to top 10 per category
    });

    return categories;
  }, [opportunities, aiRecommendations, businessType]);

  // Compute zone analysis data for Zone Analysis tab
  const zoneAnalysisData = useMemo(() => {
    const zoneType = aggregateZoneAnalysis.bestZone;
    const commercialRatio = clusterKPIs.commercialZoneCount / Math.max(1, clusterKPIs.totalOpportunities);
    const residentialRatio = clusterKPIs.residentialZoneCount / Math.max(1, clusterKPIs.totalOpportunities);

    // Business activity level
    let activityLevel: "High" | "Moderate" | "Low" = "Moderate";
    if (clusterKPIs.avgBusinessDensity >= 15) activityLevel = "High";
    else if (clusterKPIs.avgBusinessDensity < 5) activityLevel = "Low";

    // Business activity time
    let activityTime: "Daytime" | "Evening" | "Balanced" = "Balanced";
    if (commercialRatio > 0.6) activityTime = "Balanced";
    else if (residentialRatio > 0.6) activityTime = "Daytime";
    else if (commercialRatio > 0.3 && residentialRatio < 0.3) activityTime = "Evening";

    // Ease of opening
    let easeOfOpening: "Easy" | "Moderate" | "Challenging" = "Moderate";
    if (clusterKPIs.avgCompetition < 2 && commercialRatio > 0.3) easeOfOpening = "Easy";
    else if (clusterKPIs.avgCompetition > 5) easeOfOpening = "Challenging";

    return {
      zoneType,
      activityLevel,
      activityTime,
      easeOfOpening,
      commercialPct: Math.round(commercialRatio * 100),
      residentialPct: Math.round(residentialRatio * 100),
      mixedPct: 100 - Math.round(commercialRatio * 100) - Math.round(residentialRatio * 100),
    };
  }, [aggregateZoneAnalysis, clusterKPIs]);

  // ============================================================================
  // EARLY RETURNS - AFTER ALL HOOKS
  // ============================================================================

  // ----------------------------------------
  // LOADING SCREEN - Centered animated loader (matching Map View)
  // ----------------------------------------
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] animate-fadeIn">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-[#1e3a5f] animate-pulse flex items-center justify-center">
            <Zap className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div className="absolute -inset-4 bg-slate-500/20 rounded-3xl blur-xl animate-pulse" />
        </div>
        <p className="mt-6 text-gray-600 font-medium">Loading opportunities...</p>
        <p className="text-sm text-gray-400 mt-1">Analyzing business data for insights</p>
      </div>
    );
  }

  // ----------------------------------------
  // ERROR STATE
  // ----------------------------------------
  if (error) {
    return (
      <div className="page-wrapper">
        <Card className="p-12 text-center border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-linear-to-br from-red-100 to-rose-200 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-700">Something went wrong</h3>
              <p className="text-gray-500 mt-1">{error}</p>
            </div>
            <Button
              onClick={loadData}
              className="mt-4 bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ----------------------------------------
  // EMPTY STATE - No clustering data
  // ----------------------------------------
  if (!clusteringResults || !clusteringResults.locations || clusteringResults.locations.length === 0) {
    return (
      <div className="page-wrapper">
        <Card className="p-12 text-center border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-linear-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <Lightbulb className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-700">No Opportunities Yet</h3>
              <p className="text-gray-500 mt-1 max-w-md">
                Run a clustering analysis on the Clustering page to discover business opportunities tailored to your preferences.
              </p>
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                onClick={() => navigate("/user/dashboard/clustering")}
                className="bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              >
                Go to Clustering
              </Button>
              <Button
                variant="outline"
                onClick={loadData}
                className="hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // EXPORT FUNCTIONS (PDF and Excel only - No CSV)
  // ---------------------------------------------------------------------------

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Clusters Summary
    const clustersSummary = clusterKPIs.clusterStats.map((cluster) => ({
      "Cluster ID": cluster.clusterId,
      "Opportunity Score": cluster.opportunityScore,
      "Avg Density": cluster.avgDensity,
      "Avg Competitors": cluster.avgCompetition,
      "Location Count": cluster.locationCount,
      "Commercial Zones": cluster.commercialCount,
      "Residential Zones": cluster.residentialCount,
      "Mixed Zones": cluster.mixedCount,
      "Center Latitude": cluster.centerLat.toFixed(6),
      "Center Longitude": cluster.centerLng.toFixed(6),
    }));
    const sheet1 = XLSX.utils.json_to_sheet(clustersSummary);
    XLSX.utils.book_append_sheet(workbook, sheet1, "Clusters Summary");

    // Sheet 2: Raw K-means Output (all locations with cluster assignment)
    // Compute dynamic density for locations with 0 values
    const rawKmeans = locations.map((loc, idx) => {
      // Calculate density dynamically if stored value is 0
      const hasDensity = loc.business_density_200m > 0 || loc.competitor_density_200m > 0;
      let businessDensity = loc.business_density_200m || 0;
      let competitorDensity = loc.competitor_density_200m || 0;

      if (!hasDensity) {
        const dynamic = computeDynamicDensity(loc, locations, 0.2);
        businessDensity = dynamic.businessDensity;
        competitorDensity = dynamic.competitorDensity;
      }

      return {
        "Point ID": idx + 1,
        "Street": loc.street,
        "Category": loc.general_category,
        "Latitude": loc.latitude,
        "Longitude": loc.longitude,
        "Assigned Cluster": loc.cluster || 0,
        "Business Density": businessDensity,
        "Competitor Density": competitorDensity,
        "Zone Type": loc.zone_type,
      };
    });
    const sheet2 = XLSX.utils.json_to_sheet(rawKmeans);
    XLSX.utils.book_append_sheet(workbook, sheet2, "Raw K-means Data");

    // Sheet 3: Insights & Recommendations
    const insightsData = clusterInsights.map((insight, idx) => ({
      "Insight #": idx + 1,
      "Insight": insight,
      "Type": insight.includes("Cluster") ? "Cluster Analysis" :
        insight.includes("commercial") ? "Zone Analysis" :
          insight.includes("Market gap") ? "Market Gap" : "General",
    }));

    // Add cluster-specific recommendations
    clusterKPIs.clusterStats.forEach((cluster) => {
      let recommendation = "";
      if (cluster.avgCompetition < 2 && cluster.avgDensity > 10) {
        recommendation = "High-value opportunity area - Recommended for new business";
      } else if (cluster.avgCompetition > 5) {
        recommendation = "High competition - Consider differentiation strategy";
      } else if (cluster.avgDensity < 5) {
        recommendation = "Emerging market - Early mover advantage possible";
      } else {
        recommendation = "Moderate opportunity - Standard market entry";
      }

      insightsData.push({
        "Insight #": insightsData.length + 1,
        "Insight": `Cluster ${cluster.clusterId}: ${recommendation}`,
        "Type": "Recommendation",
      });
    });

    const sheet3 = XLSX.utils.json_to_sheet(insightsData);
    XLSX.utils.book_append_sheet(workbook, sheet3, "Insights & Recommendations");

    XLSX.writeFile(workbook, `opportunities_report_${businessType.replace(/\s+/g, '_')}.xlsx`);
    toast.success("Exported report as Excel (3 sheets)");
    logActivity("Exported Opportunities Report", { format: "Excel", sheets: 3 });
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 15;

    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Business Opportunities Report", pageWidth / 2, yPos, { align: "center" });
    yPos += 8;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Category: ${businessType}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 5;
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 12;

    // Dashboard Metrics Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Dashboard Metrics", 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const metrics = [
      ["Total Opportunities", clusterKPIs.totalOpportunities.toString()],
      ["Number of Clusters", clusterKPIs.numClusters.toString()],
      ["Avg Business Density", clusterKPIs.avgBusinessDensity.toString()],
      ["Avg Competition", clusterKPIs.avgCompetition.toString()],
      ["Commercial Zones", clusterKPIs.commercialZoneCount.toString()],
      ["Residential Zones", clusterKPIs.residentialZoneCount.toString()],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [["Metric", "Value"]],
      body: metrics,
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      styles: { fontSize: 9 },
    });
    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // Cluster Analysis Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Cluster Analysis", 14, yPos);
    yPos += 8;

    const clusterRows = clusterKPIs.clusterStats.map((cluster) => [
      cluster.clusterId.toString(),
      cluster.opportunityScore.toString(),
      cluster.avgDensity.toString(),
      cluster.avgCompetition.toString(),
      cluster.locationCount.toString(),
      cluster.commercialCount.toString(),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Cluster", "Score", "Density", "Competition", "Locations", "Commercial"]],
      body: clusterRows,
      theme: "striped",
      headStyles: { fillColor: [16, 185, 129], textColor: 255 },
      styles: { fontSize: 8 },
    });
    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // Opportunities Table
    if (yPos > 200) {
      doc.addPage();
      yPos = 15;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Opportunity Locations", 14, yPos);
    yPos += 8;

    const oppRows = opportunities.slice(0, 20).map((o: Opportunity) => [
      o.title.substring(0, 25),
      o.cluster?.toString() ?? "0",
      o.businessDensity.toString(),
      o.competitors.toString(),
      o.zone_type,
      `${o.score}%`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Location", "Cluster", "Density", "Competitors", "Zone", "Score"]],
      body: oppRows,
      theme: "striped",
      headStyles: { fillColor: [139, 92, 246], textColor: 255 },
      styles: { fontSize: 7 },
    });
    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // Insights & Recommendations Section
    if (yPos > 220) {
      doc.addPage();
      yPos = 15;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Insights & Recommendations", 14, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    clusterInsights.forEach((insight, idx) => {
      if (yPos > 280) {
        doc.addPage();
        yPos = 15;
      }
      doc.text(`${idx + 1}. ${insight}`, 14, yPos, { maxWidth: pageWidth - 28 });
      yPos += 6;
    });

    doc.save(`opportunities_report_${businessType.replace(/\s+/g, '_')}.pdf`);
    toast.success("Exported report as PDF");
    logActivity("Exported Opportunities Report", { format: "PDF" });
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="page-wrapper space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-[#1e3a5f] p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-white/5 mask-[radial-gradient(ellipse_at_center,black_50%,transparent_100%)]" />
        <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Lightbulb className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Business Opportunities</h1>
                <p className="text-blue-100">Insights for: <span className="font-semibold text-white">{businessType}</span></p>
              </div>
            </div>
            <Badge className="bg-white/20 text-white border-0 px-4 py-2 text-sm backdrop-blur-sm">
              <Activity className="w-4 h-4 mr-2" />
              Based on {numClusters} clusters
            </Badge>
          </div>
          <div className="flex flex-wrap gap-3 mt-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm">
              <Store className="w-4 h-4" />
              <span className="text-sm font-medium">{clusterKPIs.totalOpportunities} Opportunities</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium">{totalBusinesses} Active Businesses</span>
            </div>

            {/* Action Buttons */}
            <div className="flex-1 flex justify-end gap-2">
              <Button
                onClick={() => setShowPreferencesModal(true)}
                className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              >
                <Zap className="w-4 h-4 mr-2" />
                Preferences
              </Button>
              <Button
                onClick={() => setOpenExportModal(true)}
                className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden group hover:shadow-xl transition-all hover:scale-[1.02]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Total Opportunities</CardTitle>
              <div className="p-2 bg-linear-to-br from-blue-500 to-indigo-600 rounded-lg text-white shadow-lg shadow-blue-200">
                <Lightbulb className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{clusterKPIs.totalOpportunities}</div>
            <p className="text-xs text-gray-500 mt-1">Identified locations</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden group hover:shadow-xl transition-all hover:scale-[1.02]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Avg. Business Density</CardTitle>
              <div className="p-2 bg-linear-to-br from-emerald-500 to-green-600 rounded-lg text-white shadow-lg shadow-emerald-200">
                <Store className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold bg-linear-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">{clusterKPIs.avgBusinessDensity}</div>
            <p className="text-xs text-gray-500 mt-1">Nearby businesses</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden group hover:shadow-xl transition-all hover:scale-[1.02]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Avg. Competition</CardTitle>
              <div className="p-2 bg-linear-to-br from-amber-500 to-orange-600 rounded-lg text-white shadow-lg shadow-amber-200">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold bg-linear-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">{clusterKPIs.avgCompetition}</div>
            <p className="text-xs text-gray-500 mt-1">Competitors nearby</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden group hover:shadow-xl transition-all hover:scale-[1.02]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Commercial Zones</CardTitle>
              <div className="p-2 bg-linear-to-br from-purple-500 to-violet-600 rounded-lg text-white shadow-lg shadow-purple-200">
                <MapPin className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold bg-linear-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
              {clusterKPIs.commercialZoneCount}
            </div>
            <p className="text-xs text-gray-500 mt-1">of {clusterKPIs.totalOpportunities} cluster locations</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full h-14 bg-white/80 backdrop-blur-sm shadow-lg rounded-xl p-1.5">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg font-medium transition-all">
            Overview
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="rounded-lg data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg font-medium transition-all">
            Opportunities
          </TabsTrigger>
          <TabsTrigger value="zone-analysis" className="rounded-lg data-[state=active]:bg-linear-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-lg font-medium transition-all">
            Zone Analysis
          </TabsTrigger>
          <TabsTrigger value="market-gaps" className="rounded-lg data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg font-medium transition-all">
            Market Gaps
          </TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          {/* Opportunity Summary Banner */}
          <Card className="border-0 shadow-xl overflow-hidden">
            <div className="bg-linear-to-r from-indigo-500 via-purple-500 to-pink-500 p-6 text-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Target className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-indigo-100 text-sm font-medium">Opportunity Summary</p>
                  <h2 className="text-2xl font-bold tracking-tight">{overviewSummary.category}</h2>
                </div>
              </div>
              <p className="text-indigo-100 text-sm leading-relaxed">
                Based on our location analysis, this area shows {overviewSummary.status === "Strong" ? "excellent" : overviewSummary.status === "Good" ? "promising" : "moderate"} potential
                for {businessType || "your business"} opportunities. The recommended zones have {overviewSummary.competitionLevel.toLowerCase()} competition
                and are best suited for {overviewSummary.operatingTime === "Both" ? "all-day" : overviewSummary.operatingTime.toLowerCase()} operations.
              </p>
            </div>
          </Card>

          {/* Summary Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Overall Score */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all hover:scale-[1.02]">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-linear-to-br from-indigo-500 to-purple-600 rounded-lg text-white">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Opportunity Score</span>
                </div>
                <div className="text-3xl font-bold bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {overviewSummary.overallScore}%
                </div>
                <Badge className={`mt-2 ${overviewSummary.status === "Strong" ? "bg-emerald-100 text-emerald-700" : overviewSummary.status === "Good" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                  {overviewSummary.status} Opportunity
                </Badge>
              </CardContent>
            </Card>

            {/* Operating Time */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all hover:scale-[1.02]">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-linear-to-br from-amber-500 to-orange-600 rounded-lg text-white">
                    {overviewSummary.operatingTime === "Day" ? <Sun className="w-5 h-5" /> :
                      overviewSummary.operatingTime === "Evening" ? <Moon className="w-5 h-5" /> :
                        <Clock className="w-5 h-5" />}
                  </div>
                  <span className="text-sm font-medium text-gray-600">Best Operating Time</span>
                </div>
                <div className="text-2xl font-bold text-gray-800">{overviewSummary.operatingTime}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {overviewSummary.operatingTime === "Both" ? "All-day operations recommended" :
                    overviewSummary.operatingTime === "Day" ? "Morning to afternoon peak" :
                      "Afternoon to night peak"}
                </p>
              </CardContent>
            </Card>

            {/* Setup Speed */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all hover:scale-[1.02]">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-linear-to-br from-emerald-500 to-teal-600 rounded-lg text-white">
                    <Rocket className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Setup Speed</span>
                </div>
                <div className="text-2xl font-bold text-gray-800">{overviewSummary.setupSpeed}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {overviewSummary.setupSpeed === "Fast" ? "Can open within weeks" :
                    overviewSummary.setupSpeed === "Moderate" ? "1-2 months preparation" :
                      "3+ months setup time"}
                </p>
              </CardContent>
            </Card>

            {/* Competition Level */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all hover:scale-[1.02]">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-linear-to-br from-rose-500 to-pink-600 rounded-lg text-white">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Competition Level</span>
                </div>
                <div className="text-2xl font-bold text-gray-800">{overviewSummary.competitionLevel}</div>
                <Badge className={`mt-1 ${overviewSummary.competitionLevel === "Low" ? "bg-emerald-100 text-emerald-700" : overviewSummary.competitionLevel === "Medium" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                  {overviewSummary.competitionLevel === "Low" ? "Easy entry" : overviewSummary.competitionLevel === "Medium" ? "Some rivals" : "Crowded market"}
                </Badge>
              </CardContent>
            </Card>

            {/* Opportunity Focus */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all hover:scale-[1.02]">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-linear-to-br from-cyan-500 to-blue-600 rounded-lg text-white">
                    <Target className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Opportunity Focus</span>
                </div>
                <div className="text-lg font-bold text-gray-800">{overviewSummary.opportunityFocus}</div>
                <p className="text-xs text-gray-500 mt-1">Based on local conditions</p>
              </CardContent>
            </Card>

            {/* Area Readiness */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all hover:scale-[1.02]">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-linear-to-br from-violet-500 to-purple-600 rounded-lg text-white">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">Area Readiness</span>
                </div>
                <div className="text-2xl font-bold text-gray-800">{overviewSummary.areaReadiness}</div>
                <Badge className={`mt-1 ${overviewSummary.areaReadiness === "High" ? "bg-emerald-100 text-emerald-700" : overviewSummary.areaReadiness === "Medium" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                  {overviewSummary.areaReadiness === "High" ? "Ready for business" : overviewSummary.areaReadiness === "Medium" ? "Some preparation needed" : "Requires development"}
                </Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>


        {/* OPPORTUNITIES TAB */}
        <TabsContent value="opportunities" className="space-y-6">
          {/* Header with Export */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Ranked Business Opportunities</h2>
              <p className="text-gray-500 mt-1">Business types ranked from highest to lowest opportunity score</p>
            </div>
            <Button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-6 py-3 h-12 bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-200 transition-all hover:scale-[1.02]"
            >
              <FileDown className="w-5 h-5" />
              Export Report
            </Button>
          </div>

          {/* Export Modal (PDF and Excel only) */}
          {openExportModal && (
            <>
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
              <div className="fixed z-50 bg-white p-8 rounded-2xl shadow-2xl w-[420px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <h2 className="text-xl font-bold mb-1">Export Report</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Choose a file format. PDF includes charts and insights.
                </p>

                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full h-14 flex justify-start gap-3 rounded-xl hover:bg-red-50 hover:border-red-300 transition-all"
                    onClick={exportPDF}
                  >
                    <div className="p-2 bg-red-100 rounded-lg">
                      <FileText className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="text-left">
                      <span className="font-medium block">Export as PDF</span>
                      <span className="text-xs text-gray-500">Dashboard, charts, insights</span>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full h-14 flex justify-start gap-3 rounded-xl hover:bg-green-50 hover:border-green-300 transition-all"
                    onClick={exportExcel}
                  >
                    <div className="p-2 bg-green-100 rounded-lg">
                      <FileType className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="text-left">
                      <span className="font-medium block">Export as Excel</span>
                      <span className="text-xs text-gray-500">3 sheets: Clusters, Raw Data, Insights</span>
                    </div>
                  </Button>
                </div>

                <Button
                  className="w-full mt-6 h-12 bg-linear-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white rounded-xl"
                  onClick={() => setOpenExportModal(false)}
                >
                  Close
                </Button>
              </div>
            </>
          )}

          {/* AI Recommended Businesses (if available) */}
          {aiRecommendations?.topBusinesses && aiRecommendations.topBusinesses.length > 0 && (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-linear-to-r from-purple-50 to-pink-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-linear-to-br from-purple-500 to-pink-600 rounded-xl text-white shadow-lg shadow-purple-200">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Top Recommended for {businessType}</CardTitle>
                    <p className="text-sm text-gray-500">Best business opportunities based on location analysis</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid gap-4">
                  {aiRecommendations.topBusinesses.map((biz, index) => {
                    const score = biz.score || biz.fitPercentage || 70;
                    const status = getStatusFromScore(score);
                    return (
                      <div
                        key={index}
                        className="p-5 rounded-xl border-2 bg-white hover:shadow-lg transition-all"
                        style={{ borderColor: status === "Strong" ? "#10b98130" : status === "Good" ? "#3b82f630" : "#f59e0b30" }}
                      >
                        <div className="flex items-start justify-between flex-wrap gap-4">
                          <div className="flex items-start gap-4">
                            <div className={`flex items-center justify-center w-10 h-10 rounded-xl text-white font-bold shadow-lg ${status === "Strong" ? "bg-linear-to-br from-emerald-500 to-green-600" : status === "Good" ? "bg-linear-to-br from-blue-500 to-indigo-600" : "bg-linear-to-br from-amber-500 to-orange-600"}`}>
                              {index + 1}
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-gray-800">{biz.name}</h3>
                              <p className="text-sm text-gray-500 mt-1">{biz.shortDescription || biz.fullDetails}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="text-3xl font-bold bg-linear-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                              {score}%
                            </div>
                            <Badge className={`${status === "Strong" ? "bg-emerald-100 text-emerald-700" : status === "Good" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                              {status} Opportunity
                            </Badge>
                          </div>
                        </div>

                        {/* Additional details */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-amber-500" />
                            <span className="text-gray-600">{determineOperatingTime(biz.name, "")} hours</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Rocket className="w-4 h-4 text-emerald-500" />
                            <span className="text-gray-600">{determineSetupSpeed(biz.name)} setup</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="w-4 h-4 text-rose-500" />
                            <span className="text-gray-600">{biz.opportunityLevel?.includes("High") ? "Low" : biz.opportunityLevel?.includes("Low") ? "High" : "Medium"} competition</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 className="w-4 h-4 text-blue-500" />
                            <span className="text-gray-600">{biz.startupBudget || "Varies"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommended for You - Personalized Insights */}
          <RecommendedForYou
            businessType={businessType}
            competitionLevel={overviewSummary.competitionLevel}
            zoneType={zoneAnalysisData.zoneType}
            activityTime={overviewSummary.operatingTime}
            avgDensity={clusterKPIs.avgBusinessDensity}
            avgCompetitors={clusterKPIs.avgCompetition}
            clusterCount={clusterKPIs.numClusters}
          />

          {/* Grouped by Category */}
          {Array.from(opportunitiesByCategory.entries()).map(([category, opps]) => (
            <Card key={category} className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-linear-to-r from-slate-50 to-gray-50 border-b">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-linear-to-br from-slate-600 to-gray-700 rounded-xl text-white shadow-lg">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{category}</CardTitle>
                      <p className="text-sm text-gray-500">{opps.length} opportunities ranked by score</p>
                    </div>
                  </div>
                  <Badge className="bg-slate-100 text-slate-700 border-0 px-3 py-1">
                    Top Score: {opps[0]?.score || 0}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {opps.slice(0, showAll ? opps.length : 5).map((op, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 rounded-xl border bg-white hover:shadow-md transition-all hover:border-indigo-200"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-lg text-white text-sm font-bold ${op.status === "Strong" ? "bg-emerald-500" : op.status === "Good" ? "bg-blue-500" : "bg-amber-500"}`}>
                          {index + 1}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800 text-sm">{op.name}</h4>
                          {op.description && <p className="text-xs text-gray-500 mt-0.5 truncate max-w-md">{op.description}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Operating Time */}
                        <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-500">
                          {op.operatingTime === "Day" ? <Sun className="w-3.5 h-3.5 text-amber-500" /> :
                            op.operatingTime === "Evening" ? <Moon className="w-3.5 h-3.5 text-indigo-500" /> :
                              <Clock className="w-3.5 h-3.5 text-blue-500" />}
                          <span>{op.operatingTime}</span>
                        </div>

                        {/* Setup Speed */}
                        <Badge variant="outline" className="hidden md:flex text-xs">
                          <Rocket className="w-3 h-3 mr-1" />
                          {op.setupSpeed}
                        </Badge>

                        {/* Competition */}
                        <Badge className={`text-xs ${op.competitionLevel === "Low" ? "bg-emerald-100 text-emerald-700" : op.competitionLevel === "Medium" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                          {op.competitionLevel}
                        </Badge>

                        {/* Score */}
                        <div className="flex items-center gap-2">
                          <div className={`text-lg font-bold ${op.status === "Strong" ? "text-emerald-600" : op.status === "Good" ? "text-blue-600" : "text-amber-600"}`}>
                            {op.score}%
                          </div>
                          <Badge className={`${op.status === "Strong" ? "bg-emerald-500" : op.status === "Good" ? "bg-blue-500" : "bg-amber-500"} text-white text-xs`}>
                            {op.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {opps.length > 5 && !showAll && (
                  <Button
                    variant="ghost"
                    className="w-full mt-4 text-gray-500 hover:text-gray-700"
                    onClick={() => setShowAll(true)}
                  >
                    Show all {opps.length} opportunities
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}

          {opportunitiesByCategory.size === 0 && (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm p-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Lightbulb className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700">No opportunities yet</h3>
                <p className="text-gray-500 mt-2 max-w-md">
                  Run a clustering analysis on the Clustering page to discover business opportunities tailored to your preferences.
                </p>
                <Button
                  onClick={() => navigate("/user/dashboard/clustering")}
                  className="mt-4 bg-linear-to-r from-blue-500 to-indigo-600"
                >
                  Go to Clustering
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ZONE ANALYSIS TAB */}
        <TabsContent value="zone-analysis" className="space-y-6">
          {/* Zone Characteristics Summary */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-linear-to-r from-emerald-50 to-teal-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-linear-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-lg shadow-emerald-200">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">Area Characteristics</CardTitle>
                  <p className="text-sm text-gray-500">Understanding the recommended locations</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Zone Type */}
                <div className="p-5 rounded-xl bg-linear-to-br from-blue-50 to-indigo-50 border border-blue-100">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-gray-600">Zone Type</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-700">{zoneAnalysisData.zoneType}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {zoneAnalysisData.zoneType === "Commercial" ? "High visibility business area" :
                      zoneAnalysisData.zoneType === "Residential" ? "Community-focused neighborhood" :
                        "Balanced mix of businesses and residences"}
                  </p>
                </div>

                {/* Activity Level */}
                <div className="p-5 rounded-xl bg-linear-to-br from-emerald-50 to-green-50 border border-emerald-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-medium text-gray-600">Business Activity</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-700">{zoneAnalysisData.activityLevel}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {zoneAnalysisData.activityLevel === "High" ? "Busy area with many businesses" :
                      zoneAnalysisData.activityLevel === "Low" ? "Quiet area with growth potential" :
                        "Steady business presence"}
                  </p>
                </div>

                {/* Best Time */}
                <div className="p-5 rounded-xl bg-linear-to-br from-amber-50 to-orange-50 border border-amber-100">
                  <div className="flex items-center gap-2 mb-3">
                    {zoneAnalysisData.activityTime === "Daytime" ? <Sun className="w-5 h-5 text-amber-600" /> :
                      zoneAnalysisData.activityTime === "Evening" ? <Moon className="w-5 h-5 text-amber-600" /> :
                        <Clock className="w-5 h-5 text-amber-600" />}
                    <span className="text-sm font-medium text-gray-600">Strong Business Time</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-700">{zoneAnalysisData.activityTime}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {zoneAnalysisData.activityTime === "Daytime" ? "Morning to afternoon peak" :
                      zoneAnalysisData.activityTime === "Evening" ? "Afternoon to night peak" :
                        "Consistent activity all day"}
                  </p>
                </div>

                {/* Ease of Opening */}
                <div className="p-5 rounded-xl bg-linear-to-br from-purple-50 to-violet-50 border border-purple-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Rocket className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-medium text-gray-600">Ease of Opening</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-700">{zoneAnalysisData.easeOfOpening}</div>
                  <p className="text-xs text-gray-500 mt-1">
                    {zoneAnalysisData.easeOfOpening === "Easy" ? "Low barriers to entry" :
                      zoneAnalysisData.easeOfOpening === "Challenging" ? "May require differentiation" :
                        "Standard market conditions"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Activity Time Section */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-linear-to-r from-amber-50 to-orange-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-linear-to-br from-amber-500 to-orange-600 rounded-xl text-white shadow-lg shadow-amber-200">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">Business Activity Time</CardTitle>
                  <p className="text-sm text-gray-500">When businesses in this area are most active</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Time Distribution Visualization */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-amber-500" />
                    Activity Pattern
                  </h4>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 w-24">
                        <Sun className="w-4 h-4 text-amber-500" />
                        <span className="text-sm text-gray-600">Daytime</span>
                      </div>
                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-linear-to-r from-amber-400 to-orange-500 rounded-full transition-all"
                          style={{ width: `${zoneAnalysisData.activityTime === "Daytime" ? 75 : zoneAnalysisData.activityTime === "Balanced" ? 50 : 30}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-600 w-12 text-right">
                        {zoneAnalysisData.activityTime === "Daytime" ? "High" : zoneAnalysisData.activityTime === "Balanced" ? "Med" : "Low"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 w-24">
                        <Moon className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm text-gray-600">Evening</span>
                      </div>
                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-linear-to-r from-indigo-400 to-purple-500 rounded-full transition-all"
                          style={{ width: `${zoneAnalysisData.activityTime === "Evening" ? 75 : zoneAnalysisData.activityTime === "Balanced" ? 50 : 30}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-600 w-12 text-right">
                        {zoneAnalysisData.activityTime === "Evening" ? "High" : zoneAnalysisData.activityTime === "Balanced" ? "Med" : "Low"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Time Recommendations */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    Operating Hour Recommendations
                  </h4>

                  <div className="space-y-3">
                    {zoneAnalysisData.activityTime === "Daytime" ? (
                      <>
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                          <p className="text-sm text-gray-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 inline mr-2" />
                            Best hours: <span className="font-semibold">8 AM - 6 PM</span>
                          </p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <p className="text-sm text-gray-700">
                            <AlertTriangle className="w-4 h-4 text-amber-500 inline mr-2" />
                            Evening operations may have lower foot traffic
                          </p>
                        </div>
                      </>
                    ) : zoneAnalysisData.activityTime === "Evening" ? (
                      <>
                        <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                          <p className="text-sm text-gray-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 inline mr-2" />
                            Best hours: <span className="font-semibold">4 PM - 10 PM</span>
                          </p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <p className="text-sm text-gray-700">
                            <AlertTriangle className="w-4 h-4 text-amber-500 inline mr-2" />
                            Morning hours may be slower for customer traffic
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                          <p className="text-sm text-gray-700">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 inline mr-2" />
                            Flexible hours: <span className="font-semibold">8 AM - 9 PM</span>
                          </p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <p className="text-sm text-gray-700">
                            <Sparkles className="w-4 h-4 text-purple-500 inline mr-2" />
                            Area supports both day and evening operations
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Zone Analysis Component */}
          <ZoneAnalysis
            analysis={aggregateZoneAnalysis}
            suitability={aggregateSuitability}
            category={businessType}
          />

          {/* Insights Panel */}
          <InsightsPanel insights={aggregateInsights} />
        </TabsContent>

        {/* MARKET GAPS TAB */}
        <TabsContent value="market-gaps" className="space-y-6">
          {/* First Mover Opportunities */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-linear-to-r from-purple-50 to-pink-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-linear-to-br from-purple-500 to-pink-600 rounded-xl text-white shadow-lg shadow-purple-200">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">First-Mover Opportunities</CardTitle>
                  <p className="text-sm text-gray-500">
                    Categories with little to no competition — ideal for new entrants
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {marketGaps.filter(g => g.gapLevel === "High").length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {marketGaps.filter(g => g.gapLevel === "High").slice(0, 6).map((gap, index) => (
                    <div
                      key={gap.category}
                      className="p-5 rounded-xl border-2 border-purple-100 bg-linear-to-br from-purple-50 to-pink-50 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-linear-to-br from-purple-500 to-pink-600 text-white flex items-center justify-center font-bold text-sm">
                          {index + 1}
                        </div>
                        <h4 className="font-bold text-gray-800">{gap.category}</h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        {gap.supply === 0 ? "No competitors in this area" : `Only ${gap.supply} competitors nearby`}
                      </p>
                      <Badge className="bg-purple-100 text-purple-700 border-0">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        High Potential
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No high-gap opportunities identified yet. The market appears balanced.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Time-Based Gaps */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-linear-to-r from-amber-50 to-orange-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-linear-to-br from-amber-500 to-orange-600 rounded-xl text-white shadow-lg shadow-amber-200">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">Time-Based Gaps</CardTitle>
                  <p className="text-sm text-gray-500">
                    Underserved time periods based on nearby business patterns
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Morning Gap */}
                <div className="p-5 rounded-xl border bg-white hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Sun className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">Morning Hours (6 AM - 11 AM)</h4>
                      <Badge className={`mt-1 ${zoneAnalysisData.activityTime === "Evening" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {zoneAnalysisData.activityTime === "Evening" ? "Underserved" : "Well Covered"}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {zoneAnalysisData.activityTime === "Evening"
                      ? "Few businesses cater to early morning customers. Consider breakfast spots or early-open services."
                      : "Good coverage from existing businesses. Competition may be higher."}
                  </p>
                </div>

                {/* Evening Gap */}
                <div className="p-5 rounded-xl border bg-white hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Moon className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">Evening Hours (6 PM - 10 PM)</h4>
                      <Badge className={`mt-1 ${zoneAnalysisData.activityTime === "Daytime" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {zoneAnalysisData.activityTime === "Daytime" ? "Underserved" : "Well Covered"}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {zoneAnalysisData.activityTime === "Daytime"
                      ? "Limited evening options available. Consider dinner restaurants or entertainment venues."
                      : "Good coverage for evening customers. Focus on differentiation."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Underserved Categories with Suggestions */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-linear-to-r from-rose-50 to-pink-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-linear-to-br from-rose-500 to-pink-600 rounded-xl text-white shadow-lg shadow-rose-200">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">Market Gap Analysis</CardTitle>
                  <p className="text-sm text-gray-500">
                    Categories ranked by opportunity with actionable suggestions
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {marketGaps.map((gap, index) => {
                const maxValue = Math.max(gap.demand, gap.supply, 1);
                const demandPercent = Math.round(
                  (gap.demand / maxValue) * 100
                );
                const supplyPercent = Math.round(
                  (gap.supply / maxValue) * 100
                );

                return (
                  <div
                    key={gap.category}
                    className="border-2 rounded-2xl p-6 space-y-4 bg-white hover:shadow-xl transition-all hover:scale-[1.005]"
                    style={{ borderColor: gap.gapLevel === 'High' ? '#f43f5e30' : gap.gapLevel === 'Medium' ? '#f59e0b30' : '#6b728030' }}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-linear-to-br from-rose-500 to-pink-600 text-white font-bold text-sm shadow-lg">
                            {index + 1}
                          </span>
                          <p className="text-lg font-bold text-gray-900">
                            {gap.category}
                          </p>
                          <Badge
                            className={`border-0 text-white shadow-md ${gap.gapLevel === "High"
                              ? "bg-linear-to-r from-rose-500 to-pink-600"
                              : gap.gapLevel === "Medium"
                                ? "bg-linear-to-r from-amber-500 to-orange-600"
                                : "bg-linear-to-r from-gray-500 to-slate-600"
                              }`}
                          >
                            {gap.gapLevel} Gap
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">
                          Gap Score: <span className="font-semibold text-rose-600">{gap.gapScore}</span> (demand minus supply)
                        </p>
                      </div>
                      <div className="text-right p-4 bg-linear-to-br from-rose-50 to-pink-50 rounded-xl">
                        <p className="text-3xl font-bold text-rose-600">
                          {gap.demand}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Avg. demand index
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-700">Market Demand</span>
                          <span className="font-semibold text-emerald-600">{gap.demand}</span>
                        </div>
                        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-linear-to-r from-emerald-400 to-green-500 rounded-full transition-all"
                            style={{ width: `${demandPercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-700">Current Supply</span>
                          <span className="font-semibold text-amber-600">{gap.supply}</span>
                        </div>
                        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-linear-to-r from-amber-400 to-orange-500 rounded-full transition-all"
                            style={{ width: `${supplyPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Time-based gap info */}
                    {gap.timeGap && (
                      <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                        <div className="flex items-start gap-3">
                          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-amber-800">{gap.timeGap}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actionable suggestion */}
                    {gap.suggestion && (
                      <div className="p-4 bg-linear-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                        <div className="flex items-start gap-3">
                          <Lightbulb className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-1">Suggestion</p>
                            <p className="text-sm text-gray-600">{gap.suggestion}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-indigo-500" />
                        Recommended Locations
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {gap.recommendedLocations.length > 0 ? (
                          gap.recommendedLocations.map((loc) => (
                            <Badge
                              key={loc}
                              variant="outline"
                              className="px-3 py-1.5 font-medium hover:bg-indigo-50 hover:border-indigo-300 transition-colors cursor-pointer"
                            >
                              {loc}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500 italic">
                            No specific recommended streets yet for this category.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {marketGaps.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700">No market gaps detected</h3>
                  <p className="text-gray-500 mt-2">Run a clustering analysis to identify market opportunities.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preferences Modal */}
      {showPreferencesModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b bg-linear-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-linear-to-br from-blue-500 to-indigo-600 rounded-xl text-white">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Preferences</h2>
                    <p className="text-sm text-gray-500">Personalize your opportunity scores</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowPreferencesModal(false)}>
                  ✕
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Business Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Business Type</label>
                <select
                  value={preferences.businessType}
                  onChange={(e) => setPreferences({ ...preferences, businessType: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Any Category</option>
                  <option value="Food">Food / Restaurant</option>
                  <option value="Retail">Retail</option>
                  <option value="Services">Services</option>
                  <option value="Pharmacy">Pharmacy</option>
                  <option value="Entertainment">Entertainment / Leisure</option>
                  <option value="Trading">Merchandise / Trading</option>
                </select>
              </div>

              {/* Radius Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Radius Range: <span className="text-blue-600">{preferences.radiusRange}m</span>
                </label>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="100"
                  value={preferences.radiusRange}
                  onChange={(e) => setPreferences({ ...preferences, radiusRange: Number(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>100m</span>
                  <span>2000m</span>
                </div>
              </div>

              {/* Budget Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Monthly Budget: <span className="text-blue-600">₱{preferences.budgetMin.toLocaleString()} - ₱{preferences.budgetMax.toLocaleString()}</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    placeholder="Min"
                    value={preferences.budgetMin}
                    onChange={(e) => setPreferences({ ...preferences, budgetMin: Number(e.target.value) })}
                    className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={preferences.budgetMax}
                    onChange={(e) => setPreferences({ ...preferences, budgetMax: Number(e.target.value) })}
                    className="px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Startup Capital */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Startup Capital: <span className="text-blue-600">₱{preferences.startupCapital.toLocaleString()}</span>
                </label>
                <input
                  type="range"
                  min="20000"
                  max="1000000"
                  step="10000"
                  value={preferences.startupCapital}
                  onChange={(e) => setPreferences({ ...preferences, startupCapital: Number(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>₱20k</span>
                  <span>₱1M</span>
                </div>
              </div>

              {/* Competitor Tolerance */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Competitor Tolerance</label>
                <div className="flex gap-3">
                  {(["Low", "Medium", "High"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setPreferences({ ...preferences, competitorTolerance: level })}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${preferences.competitorTolerance === level
                        ? "bg-blue-600 text-white shadow-lg"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer Priority */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Customer Demand Priority: <span className="text-blue-600">{preferences.customerPriority}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={preferences.customerPriority}
                  onChange={(e) => setPreferences({ ...preferences, customerPriority: Number(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Low priority</span>
                  <span>High priority</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setPreferences(DEFAULT_PREFERENCES);
                  setAppliedPreferences(null);
                  setShowPreferencesModal(false);
                  toast.success("Preferences reset to default");
                }}
              >
                Reset
              </Button>
              <Button
                className="flex-1 bg-linear-to-r from-blue-600 to-indigo-600 text-white"
                onClick={() => {
                  setAppliedPreferences({ ...preferences });
                  setShowPreferencesModal(false);
                  toast.success("Preferences applied! Opportunities reranked.");
                }}
              >
                Apply Preferences
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {openExportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Export Report</h2>
                <Button variant="ghost" size="sm" onClick={() => setOpenExportModal(false)}>
                  ✕
                </Button>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <Button
                className="w-full justify-start gap-3 h-14"
                variant="outline"
                onClick={() => {
                  exportPDF();
                  setOpenExportModal(false);
                }}
              >
                <FileText className="w-5 h-5 text-red-500" />
                <div className="text-left">
                  <div className="font-medium">PDF Report</div>
                  <div className="text-xs text-gray-500">Dashboard metrics, charts, insights</div>
                </div>
              </Button>
              <Button
                className="w-full justify-start gap-3 h-14"
                variant="outline"
                onClick={() => {
                  exportExcel();
                  setOpenExportModal(false);
                }}
              >
                <FileType className="w-5 h-5 text-green-500" />
                <div className="text-left">
                  <div className="font-medium">Excel Workbook</div>
                  <div className="text-xs text-gray-500">3 sheets: Clusters, Raw Data, Insights</div>
                </div>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
