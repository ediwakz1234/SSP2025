import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
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
  FileSpreadsheet,
  FileText,
  FileType,
  Lightbulb,
  MapPin,
  Store,
  TrendingDown,
  Zap,
} from "lucide-react";


import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { RefreshCw, AlertCircle } from "lucide-react";
import { Skeleton } from "../shared/ErrorBoundary";

// New imports for enhanced features
import {
  determineBestZone,
  evaluateZoneSuitability,
  evaluateTimeWorkFeasibility,
  estimateRequiredCapital,
  estimateProfitability,
  assessRiskLevel,
  suggestBusinessModel,
  generateZoneInsights,
} from "../../utils/zoneAnalysis";
import { BusinessOpportunityCard, type EnhancedOpportunityData } from "./BusinessOpportunityCard";
import { InsightsPanel, generateInsightsPanelData } from "./InsightsPanel";
import { ZoneAnalysis } from "./ZoneAnalysis";

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

  // Group locations by cluster
  const clusterMap = new Map<number, LocationData[]>();
  locations.forEach(loc => {
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

  // Overall averages
  const totalOpportunities = locations.length;
  const avgBusinessDensity = Math.round(
    locations.reduce((s, loc) => s + (loc.business_density_200m || 0), 0) / locations.length
  );
  const avgCompetition = Math.round(
    locations.reduce((s, loc) => s + (loc.competitor_density_200m || 0), 0) / locations.length * 10
  ) / 10;

  // Zone counts
  const commercialZoneCount = locations.filter(loc =>
    loc.zone_type?.toLowerCase() === 'commercial'
  ).length;
  const residentialZoneCount = locations.filter(loc =>
    loc.zone_type?.toLowerCase() === 'residential'
  ).length;

  // Category distribution across all clusters
  const catMap = new Map<string, number>();
  locations.forEach(loc => {
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

// Generate auto-insights from K-means cluster analysis
function generateClusterInsights(kpis: ClusterKPIs): string[] {
  const insights: string[] = [];

  if (kpis.totalOpportunities === 0) {
    return ["No clustering data available. Run a clustering analysis first."];
  }

  // Best cluster insight
  if (kpis.bestCluster) {
    insights.push(`Cluster ${kpis.bestCluster.clusterId} has the highest opportunity score (${kpis.bestCluster.opportunityScore}) with ${kpis.bestCluster.locationCount} locations`);
  }

  // Lowest competition cluster
  if (kpis.lowestCompetitionCluster && kpis.lowestCompetitionCluster.avgCompetition < 3) {
    insights.push(`Cluster ${kpis.lowestCompetitionCluster.clusterId} has lowest competition (${kpis.lowestCompetitionCluster.avgCompetition}) — great for new market entry`);
  }

  // Highest density cluster
  if (kpis.highestDensityCluster && kpis.highestDensityCluster.avgDensity > 15) {
    insights.push(`Cluster ${kpis.highestDensityCluster.clusterId} has highest business density (${kpis.highestDensityCluster.avgDensity}) indicating strong commercial activity`);
  }

  // High-value opportunity areas (low competition + high density)
  kpis.clusterStats.forEach(cluster => {
    if (cluster.avgCompetition < 2 && cluster.avgDensity > 10) {
      insights.push(`High-value opportunity: Cluster ${cluster.clusterId} has low competition (${cluster.avgCompetition}) with high business activity`);
    }
  });

  // Untapped areas
  kpis.clusterStats.forEach(cluster => {
    if (cluster.avgDensity < 5 && cluster.avgCompetition === 0) {
      insights.push(`Untapped market: Cluster ${cluster.clusterId} has minimal business presence — first mover advantage available`);
    }
  });

  // Commercial vs Residential balance
  const commercialPct = Math.round((kpis.commercialZoneCount / kpis.totalOpportunities) * 100);
  if (commercialPct > 70) {
    insights.push(`${commercialPct}% of opportunities are in commercial zones — high foot traffic expected`);
  } else if (commercialPct < 30) {
    insights.push(`${commercialPct}% of opportunities are in commercial zones — consider community-focused business models`);
  }

  // Category gaps
  if (kpis.categoryDistribution.length < 3) {
    insights.push("Market gap detected: Limited category diversity — opportunity to introduce new business types");
  }

  return insights.slice(0, 6); // Limit to top 6 insights
}

// Legacy calculateKPIs for backward compatibility (now uses cluster data)
function calculateKPIs(opps: Opportunity[]) {
  if (opps.length === 0) {
    return {
      totalOpportunities: 0,
      avgBusinessDensity: 0,
      avgCompetition: 0,
      commercialZones: 0,
    };
  }

  const totalOpportunities = opps.length;

  const avgBusinessDensity = Math.round(
    opps.reduce((s, o) => s + o.businessDensity, 0) / opps.length
  );

  const avgCompetition = Math.round(
    opps.reduce((s, o) => s + o.competitors, 0) / opps.length
  );

  const commercialZones = Math.round(
    (opps.filter((o) => o.zone_type === "Commercial").length /
      opps.length) *
    100
  );

  return {
    totalOpportunities,
    avgBusinessDensity,
    avgCompetition,
    commercialZones,
  };
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
    { totalDemand: number; totalSupply: number; count: number }
  >();

  businesses.forEach((b) => {
    const key = b.general_category || "Uncategorized";
    const prev = map.get(key) ?? {
      totalDemand: 0,
      totalSupply: 0,
      count: 0,
    };

    map.set(key, {
      totalDemand: prev.totalDemand + (b.business_density_200m || 0),
      totalSupply: prev.totalSupply + (b.competitor_density_200m || 0),
      count: prev.count + 1,
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

    gaps.push({
      category: key,
      demand,
      supply,
      gapScore,
      gapLevel: classifyGapLevel(gapScore),
      recommendedLocations: recLocations,
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

  // Build enhanced opportunities with new fields
  const enhancedOpportunities: EnhancedOpportunityData[] = useMemo(() => {
    if (opportunities.length === 0) return [];

    return opportunities.map((op) => {
      const zoneAnalysis = determineBestZone(
        op.businessDensity,
        op.competitors,
        op.zone_type,
        businessType
      );
      const suitability = evaluateZoneSuitability(
        businessType,
        op.businessDensity,
        op.competitors
      );
      const timeFeasibility = evaluateTimeWorkFeasibility(businessType, op.zone_type);
      const capital = estimateRequiredCapital(businessType, op.zone_type);
      const profitability = estimateProfitability(op.businessDensity, op.competitors, businessType);
      const risk = assessRiskLevel(op.competitors, businessType);
      const model = suggestBusinessModel(businessType, op.zone_type, op.competitors);
      const zoneInsights = generateZoneInsights(op.zone_type, businessType, op.businessDensity, op.competitors);

      return {
        ...op,
        requiredCapital: capital,
        expectedProfitability: profitability,
        riskLevel: risk,
        suggestedBusinessModel: model,
        timeWorkFeasibility: timeFeasibility,
        zoneSuitability: suitability.suitability,
        insights: [...op.insights, ...zoneInsights],
      };
    });
  }, [opportunities, businessType]);

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

  // Derived values
  const displayedOps = showAll ? enhancedOpportunities : enhancedOpportunities.slice(0, 5);
  const kpis = useMemo(() => calculateKPIs(opportunities), [opportunities]);

  // K-means cluster-based KPIs (derived from raw location data)
  const clusterKPIs = useMemo(() =>
    calculateClusterKPIs(locations, numClusters),
    [locations, numClusters]
  );

  // Auto-generated cluster insights
  const clusterInsights = useMemo(() =>
    generateClusterInsights(clusterKPIs),
    [clusterKPIs]
  );

  const categoryStats = useMemo(() => buildCategoryStats(businesses), [businesses]);
  const zoneStats = useMemo(() => buildZoneStats(businesses), [businesses]);
  const totalBusinesses = businesses.length;
  const marketGaps = useMemo(() => buildMarketGaps(businesses, opportunities), [businesses, opportunities]);
  const topCategory = categoryStats[0];
  const lowestCompetition = useMemo(() =>
    [...categoryStats].sort((a, b) => a.avgCompetitors - b.avgCompetitors)[0],
    [categoryStats]
  );

  // ============================================================================
  // EARLY RETURNS - AFTER ALL HOOKS
  // ============================================================================

  // ----------------------------------------
  // LOADING SCREEN - Skeleton Cards
  // ----------------------------------------
  if (loading) {
    return (
      <div className="space-y-8 p-6">
        {/* Hero skeleton */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-blue-100 to-indigo-100 p-8 animate-pulse">
          <div className="h-10 w-64 bg-blue-200 rounded-lg mb-4" />
          <div className="h-5 w-96 bg-blue-200/70 rounded" />
        </div>

        {/* KPI Cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-0 shadow-md animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 w-24 bg-gray-200 rounded mb-3" />
                <div className="h-8 w-16 bg-gray-200 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Opportunity cards skeleton */}
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-0 shadow-lg animate-pulse">
              <CardHeader className="bg-gray-50/50 border-b">
                <div className="flex gap-2 mb-3">
                  <div className="h-6 w-20 bg-gray-200 rounded-full" />
                  <div className="h-6 w-24 bg-gray-200 rounded-full" />
                  <div className="h-6 w-20 bg-gray-200 rounded-full" />
                </div>
                <div className="h-6 w-64 bg-gray-200 rounded" />
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="p-3 bg-gray-100 rounded-xl">
                      <div className="h-4 w-12 bg-gray-200 rounded mb-2" />
                      <div className="h-6 w-8 bg-gray-200 rounded" />
                    </div>
                  ))}
                </div>
                <div className="h-20 bg-gray-100 rounded-xl" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Loading indicator */}
        <div className="text-center text-gray-500">
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Analyzing business data for insights...</span>
          </div>
        </div>
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
    const rawKmeans = locations.map((loc, idx) => ({
      "Point ID": idx + 1,
      "Street": loc.street,
      "Category": loc.general_category,
      "Latitude": loc.latitude,
      "Longitude": loc.longitude,
      "Assigned Cluster": loc.cluster || 0,
      "Business Density": loc.business_density_200m,
      "Competitor Density": loc.competitor_density_200m,
      "Zone Type": loc.zone_type,
    }));
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
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-blue-600 via-indigo-600 to-purple-700 p-8 text-white shadow-xl">
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

      {/* Quick Insights from K-means Analysis */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
        <CardHeader className="bg-linear-to-r from-amber-50 to-orange-50 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-linear-to-br from-amber-500 to-orange-600 rounded-xl text-white shadow-lg shadow-amber-200">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Quick Insights</CardTitle>
              <p className="text-sm text-gray-500">Auto-generated from K-means cluster analysis</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-3">
            {clusterInsights.length > 0 ? (
              clusterInsights.map((insight, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-4 bg-linear-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-100 hover:shadow-md transition-all"
                >
                  <div className="p-1.5 bg-amber-500 rounded-lg text-white flex-shrink-0">
                    <Lightbulb className="w-4 h-4" />
                  </div>
                  <p className="text-sm text-gray-700">{insight}</p>
                </div>
              ))
            ) : (
              <div className="col-span-2 text-center py-8 text-gray-500">
                <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No insights available. Run a clustering analysis first.</p>
              </div>
            )}
          </div>

          {/* Cluster distribution badges */}
          {clusterKPIs.clusterStats.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <p className="text-sm font-medium text-gray-600 mb-3">Cluster Overview ({clusterKPIs.numClusters} clusters)</p>
              <div className="flex flex-wrap gap-2">
                {clusterKPIs.clusterStats.slice(0, 6).map((cluster) => (
                  <Badge
                    key={cluster.clusterId}
                    className="bg-linear-to-r from-blue-500 to-indigo-600 text-white border-0 px-3 py-1.5"
                  >
                    Cluster {cluster.clusterId}: {cluster.locationCount} locations (Score: {cluster.opportunityScore})
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
          {/* Category distribution */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-linear-to-r from-blue-50 to-indigo-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-linear-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-200">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">Business Category Distribution</CardTitle>
                  <p className="text-sm text-gray-500">
                    Current businesses in your study area (Active only)
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {categoryStats.map((cat, index) => {
                const colors = [
                  'from-blue-500 to-indigo-600',
                  'from-emerald-500 to-green-600',
                  'from-amber-500 to-orange-600',
                  'from-purple-500 to-violet-600',
                  'from-rose-500 to-pink-600',
                ];
                const colorClass = colors[index % colors.length];
                return (
                  <div
                    key={cat.category}
                    className="border rounded-xl p-5 flex flex-col gap-2 bg-linear-to-br from-gray-50 to-white hover:shadow-lg transition-all hover:scale-[1.02] group"
                  >
                    <p className="text-sm font-semibold text-gray-700">{cat.category}</p>
                    <p className={`text-3xl font-bold bg-linear-to-r ${colorClass} bg-clip-text text-transparent`}>{cat.count}</p>
                    <div className="space-y-1 mt-2">
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        Avg. density: {cat.avgBusinessDensity}
                      </p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        Avg. competitors: {cat.avgCompetitors}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Zone distribution + quick insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-linear-to-r from-emerald-50 to-teal-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-linear-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-lg shadow-emerald-200">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Zone Distribution</CardTitle>
                    <p className="text-sm text-gray-500">
                      Where most active businesses are located
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {zoneStats.map((zone) => {
                  const percent =
                    totalBusinesses > 0
                      ? Math.round((zone.count / totalBusinesses) * 100)
                      : 0;
                  return (
                    <div key={zone.zone} className="space-y-2 p-3 bg-gray-50 rounded-xl">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-700">{zone.zone}</span>
                        <span className="font-semibold text-emerald-600">
                          {zone.count} ({percent}%)
                        </span>
                      </div>
                      <Progress value={percent} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-linear-to-r from-amber-50 to-orange-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-linear-to-br from-amber-500 to-orange-600 rounded-xl text-white shadow-lg shadow-amber-200">
                    <Lightbulb className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-lg">Quick Insights</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-3 p-4 bg-linear-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <div className="p-2 bg-blue-500 rounded-lg text-white">
                    <Lightbulb className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Top Category</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {topCategory
                        ? `${topCategory.category} has the most active businesses (${topCategory.count}).`
                        : "No active businesses found."}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-linear-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-100">
                  <div className="p-2 bg-emerald-500 rounded-lg text-white">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Lowest Competition</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {lowestCompetition
                        ? `${lowestCompetition.category} has relatively low competitor presence — good for new entrants.`
                        : "Not enough data to compute competition."}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-linear-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-100">
                  <div className="p-2 bg-purple-500 rounded-lg text-white">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-purple-900">Business Density</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Average of {kpis.avgBusinessDensity} nearby businesses
                      around your recommended locations.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* OPPORTUNITIES TAB */}
        <TabsContent value="opportunities" className="space-y-5">
          {/* Export button */}
          <Button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-6 py-3 h-12 bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-200 transition-all hover:scale-[1.02]"
          >
            <FileDown className="w-5 h-5" />
            Export Report
          </Button>


          {/* Export Modal */}
          {openExportModal && (
            <>
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
              <div className="fixed z-50 bg-white p-8 rounded-2xl shadow-2xl w-[420px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <h2 className="text-xl font-bold mb-1">Export Report</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Choose a file format. PDF is best for sharing. Excel and CSV
                  are best for editing.
                </p>

                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full h-14 flex justify-start gap-3 rounded-xl hover:bg-green-50 hover:border-green-300 transition-all"
                    onClick={exportCSV}
                  >
                    <div className="p-2 bg-green-100 rounded-lg">
                      <FileType className="w-5 h-5 text-green-600" />
                    </div>
                    <span className="font-medium">Export as CSV</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full h-14 flex justify-start gap-3 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all"
                    onClick={exportExcel}
                  >
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="font-medium">Export as Excel (.xlsx)</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full h-14 flex justify-start gap-3 rounded-xl hover:bg-red-50 hover:border-red-300 transition-all"
                    onClick={exportPDF}
                  >
                    <div className="p-2 bg-red-100 rounded-lg">
                      <FileText className="w-5 h-5 text-red-600" />
                    </div>
                    <span className="font-medium">Export as PDF</span>
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

          {/* Opportunity Cards */}
          {displayedOps.map((op: Opportunity, index: number) => (
            <Card key={index} className="overflow-hidden border-0 shadow-xl bg-white/80 backdrop-blur-sm group hover:shadow-2xl transition-all">
              <CardHeader className="bg-linear-to-r from-blue-50 via-indigo-50 to-purple-50 border-b">
                <div>
                  <div className="flex gap-2 mb-2">
                    <Badge className="bg-linear-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-md">
                      Cluster {op.cluster}
                    </Badge>
                    <Badge className={`border-0 text-white shadow-md ${op.score >= 70 ? 'bg-linear-to-r from-emerald-500 to-green-600' : op.score >= 40 ? 'bg-linear-to-r from-amber-500 to-orange-600' : 'bg-linear-to-r from-gray-500 to-slate-600'}`}>
                      Score: {op.score}%
                    </Badge>
                  </div>

                  <CardTitle className="text-xl group-hover:text-indigo-600 transition-colors">{op.title}</CardTitle>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                    <MapPin className="w-4 h-4 text-indigo-500" /> {op.location}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-linear-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <Store className="w-5 h-5 text-blue-600 mb-2" />
                    <p className="text-xs text-gray-500 font-medium">Business Density</p>
                    <div className="text-2xl font-bold text-blue-700">{op.businessDensity}</div>
                  </div>

                  <div className="p-4 bg-linear-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                    <TrendingDown className="w-5 h-5 text-green-600 mb-2" />
                    <p className="text-xs text-gray-500 font-medium">Competitors</p>
                    <div className="text-2xl font-bold text-green-700">{op.competitors}</div>
                  </div>

                  <div className="p-4 bg-linear-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-100">
                    <MapPin className="w-5 h-5 text-purple-600 mb-2" />
                    <p className="text-xs text-gray-500 font-medium">Zone Type</p>
                    <Badge variant="outline" className="mt-1 font-semibold">{op.zone_type}</Badge>
                  </div>

                  <div className="p-4 bg-linear-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-100">
                    <Activity className="w-5 h-5 text-orange-600 mb-2" />
                    <p className="text-xs text-gray-500 font-medium">Saturation</p>
                    <div className="text-2xl font-bold text-orange-700">{op.saturation}%</div>
                  </div>
                </div>

                {/* Insights */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-700">
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                    Key Insights & Recommendations
                  </h4>

                  <div className="grid md:grid-cols-2 gap-3">
                    {op.insights.map((txt: string, i: number) => (
                      <div
                        key={i}
                        className="p-4 bg-linear-to-r from-gray-50 to-slate-50 rounded-xl text-sm text-gray-700 border hover:border-indigo-200 transition-colors"
                      >
                        {txt}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-gray-500 font-mono">
                    📍 {op.coordinates.lat.toFixed(5)}°, {op.coordinates.lng.toFixed(5)}°
                  </div>

                  <Button
                    className="bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl shadow-lg shadow-indigo-200 transition-all hover:scale-[1.02]"
                    onClick={() =>
                      navigate("/user/dashboard/map", {
                        state: {
                          lat: op.coordinates.lat,
                          lng: op.coordinates.lng,
                          label: op.title,
                        },
                      })
                    }
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    View on Map
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {opportunities.length > 5 && !showAll && (
            <Button
              className="w-full h-14 mt-4 bg-linear-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 rounded-xl shadow-md transition-all hover:scale-[1.01]"
              onClick={() => setShowAll(true)}
            >
              Show More ({opportunities.length - 5} remaining)
            </Button>
          )}
        </TabsContent>

        {/* ZONE ANALYSIS TAB */}
        <TabsContent value="zone-analysis" className="space-y-6">
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
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-linear-to-r from-rose-50 to-pink-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-linear-to-br from-rose-500 to-pink-600 rounded-xl text-white shadow-lg shadow-rose-200">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl">Underserved Business Categories</CardTitle>
                  <p className="text-sm text-gray-500">
                    Categories with higher demand than supply based on active businesses
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
                    className="border-2 rounded-2xl p-6 space-y-4 bg-white hover:shadow-xl transition-all hover:scale-[1.01]"
                    style={{ borderColor: gap.gapLevel === 'High' ? '#f43f5e30' : gap.gapLevel === 'Medium' ? '#f59e0b30' : '#6b728030' }}
                  >
                    <div className="flex items-start justify-between gap-4">
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
