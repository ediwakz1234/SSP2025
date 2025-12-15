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
  Layers,
  X,
  ChevronDown,
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
import {
  generateTimeBasedGaps,
  getDefaultTimeBasedGaps,
  type TimeBasedGapsResult,
} from "../../utils/timeBasedGapsUtils";
import { ClusteringHistory } from "./ClusteringHistory";

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

// Opportunity types for differentiation
type OpportunityType =
  | "Best for First-Time Owners"
  | "Best for Low Budget Setup"
  | "Best for Evening Crowd"
  | "Best for Families"
  | "Best for Leisure Activities"
  | "Best for Daily Essentials"
  | "Best for Quick Service"
  | "Best for Premium Market"
  | "Best for High Traffic"
  | "Best for Community Focus";

// Demand patterns
type DemandPattern = "Daily Need" | "Evening Peak" | "Weekend Focus" | "All-Day Steady";

// User fit levels
type UserFitLevel = "High" | "Medium" | "Low";

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
  // New fields for distinct opportunities
  opportunityType: OpportunityType;
  primaryAdvantage: string;
  demandPattern: DemandPattern;
  userFitLevel: UserFitLevel;
  location?: string;
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

  // Density bonus (higher density = more accessibility)
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

// -----------------------------------------------------------------------------
// DISTINCT OPPORTUNITY GENERATORS
// -----------------------------------------------------------------------------

// Calculate score with offsets for natural variation
function calculateDistinctScore(
  baseScore: number,
  density: number,
  competitors: number,
  zoneType: string,
  category: string,
  index: number
): number {
  let score = baseScore;
  const zone = (zoneType || "").toLowerCase();
  const cat = (category || "").toLowerCase();

  // Near housing/residential area: +5
  if (zone.includes("residential") || zone.includes("mixed")) {
    score += 5;
  }

  // Near schools/offices/activity hubs: +5
  if (zone.includes("commercial") || density >= 10) {
    score += 5;
  }

  // On main road (inferred from high density): +5
  if (density >= 15) {
    score += 5;
  }

  // Low/no competitors: +5
  if (competitors <= 2) {
    score += 5;
  }

  // Underserved/first-mover area: +5
  if (competitors === 0 && density >= 5) {
    score += 5;
  }

  // All-day demand pattern: +3
  if (cat.includes("retail") || cat.includes("food")) {
    score += 3;
  }

  // Evening/weekend focused: +3
  if (cat.includes("entertainment") || cat.includes("restaurant")) {
    score += 3;
  }

  // Moderate competition: -2
  if (competitors > 2 && competitors <= 5) {
    score -= 2;
  }

  // Limited operating time window: -3
  if (cat.includes("service") && zone.includes("residential")) {
    score -= 3;
  }

  // Add small variation based on index to avoid identical scores
  const variation = ((index % 5) - 2) * 2; // Range: -4 to +4
  score += variation;

  return Math.min(100, Math.max(40, Math.round(score)));
}

// Opportunity type rotation to ensure variety
const OPPORTUNITY_TYPES: OpportunityType[] = [
  "Best for First-Time Owners",
  "Best for Low Budget Setup",
  "Best for Evening Crowd",
  "Best for Families",
  "Best for Leisure Activities",
  "Best for Daily Essentials",
  "Best for Quick Service",
  "Best for Premium Market",
  "Best for High Traffic",
  "Best for Community Focus",
];

// Generate opportunity type based on characteristics and index
function generateOpportunityType(
  competitors: number,
  density: number,
  zoneType: string,
  category: string,
  index: number
): OpportunityType {
  const zone = (zoneType || "").toLowerCase();
  const cat = (category || "").toLowerCase();

  // Use characteristics to suggest ideal type, then rotate through others
  let baseIndex = 0;

  // Low competition + residential = First-Time Owners
  if (competitors <= 1 && zone.includes("residential")) {
    baseIndex = 0;
  }
  // Low density + mixed = Low Budget Setup
  else if (density < 10 && zone.includes("mixed")) {
    baseIndex = 1;
  }
  // Commercial + evening categories = Evening Crowd
  else if (zone.includes("commercial") && (cat.includes("restaurant") || cat.includes("entertainment"))) {
    baseIndex = 2;
  }
  // Near residential + food = Families
  else if (zone.includes("residential") && (cat.includes("food") || cat.includes("retail"))) {
    baseIndex = 3;
  }
  // Entertainment category = Leisure Activities
  else if (cat.includes("entertainment") || cat.includes("leisure")) {
    baseIndex = 4;
  }
  // Retail/food = Daily Essentials
  else if (cat.includes("retail") || cat.includes("food")) {
    baseIndex = 5;
  }
  // Services = Quick Service
  else if (cat.includes("service")) {
    baseIndex = 6;
  }
  // High density commercial = Premium Market
  else if (density >= 15 && zone.includes("commercial")) {
    baseIndex = 7;
  }
  // Very high density = High Traffic
  else if (density >= 20) {
    baseIndex = 8;
  }
  // Default = Community Focus
  else {
    baseIndex = 9;
  }

  // Rotate based on index to avoid repetition
  const finalIndex = (baseIndex + index) % OPPORTUNITY_TYPES.length;
  return OPPORTUNITY_TYPES[finalIndex];
}

// Primary advantages pool - rotated to avoid repetition
const PRIMARY_ADVANTAGES = [
  "Minimal competition means easier market entry",
  "High accessibility from nearby main roads",
  "Strong demand from residential community",
  "Prime location on accessible commercial stretch",
  "Underserved area with growing population",
  "Near schools and family activity zones",
  "Evening crowd brings consistent customers",
  "Good accessibility for both residents and businesses",
  "First-mover opportunity in developing area",
  "Established customer base in the vicinity",
  "Low rental costs with good visibility",
  "Strategic position near transport routes",
  "Growing neighborhood with young demographics",
  "Weekend activity hub with leisure traffic",
  "Central location accessible from all areas",
];

// Generate primary advantage based on characteristics and index
function generatePrimaryAdvantage(
  competitors: number,
  density: number,
  zoneType: string,
  index: number
): string {
  const zone = (zoneType || "").toLowerCase();

  // Select base advantage based on characteristics
  let baseIndex = 0;

  if (competitors === 0) {
    baseIndex = 0; // Minimal competition
  } else if (density >= 15) {
    baseIndex = 1; // High accessibility
  } else if (zone.includes("residential")) {
    baseIndex = 2; // Residential community
  } else if (zone.includes("commercial")) {
    baseIndex = 3; // Commercial stretch
  } else if (competitors <= 2 && density >= 5) {
    baseIndex = 4; // Underserved area
  } else {
    baseIndex = 9; // Established customer base
  }

  // Rotate to avoid repetition
  const finalIndex = (baseIndex + index) % PRIMARY_ADVANTAGES.length;
  return PRIMARY_ADVANTAGES[finalIndex];
}

// Generate demand pattern based on zone and category
function generateDemandPattern(
  zoneType: string,
  category: string,
  index: number
): DemandPattern {
  const zone = (zoneType || "").toLowerCase();
  const cat = (category || "").toLowerCase();

  // Determine base pattern
  if (cat.includes("entertainment") || cat.includes("restaurant")) {
    // Rotate between Evening Peak and Weekend Focus
    return index % 2 === 0 ? "Evening Peak" : "Weekend Focus";
  }

  if (cat.includes("retail") || cat.includes("food")) {
    // Rotate between Daily Need and All-Day Steady
    return index % 2 === 0 ? "Daily Need" : "All-Day Steady";
  }

  if (cat.includes("service")) {
    return "Daily Need";
  }

  // Zone-based fallback
  if (zone.includes("commercial")) {
    return index % 3 === 0 ? "All-Day Steady" : index % 3 === 1 ? "Daily Need" : "Evening Peak";
  }

  if (zone.includes("residential")) {
    return index % 2 === 0 ? "Daily Need" : "Weekend Focus";
  }

  // Default rotation
  const patterns: DemandPattern[] = ["Daily Need", "Evening Peak", "Weekend Focus", "All-Day Steady"];
  return patterns[index % patterns.length];
}

// Calculate user fit level based on competition and setup complexity
function calculateUserFitLevel(
  competitors: number,
  setupSpeed: "Fast" | "Moderate" | "Slow",
  score: number
): UserFitLevel {
  // High fit: Low competition + Fast setup + Good score
  if (competitors <= 2 && setupSpeed === "Fast" && score >= 70) {
    return "High";
  }

  // Low fit: High competition OR Slow setup OR Low score
  if (competitors > 5 || setupSpeed === "Slow" || score < 55) {
    return "Low";
  }

  return "Medium";
}

// Generate purpose-based business name
function generatePurposeBasedName(
  category: string,
  opportunityType: OpportunityType,
  location: string,
  index: number
): string {
  const cat = (category || "").toLowerCase();

  // Purpose-based prefixes
  const purposePrefixes: Record<string, string[]> = {
    "first-time": ["Starter", "Entry-Level", "Beginner-Friendly"],
    "low budget": ["Budget-Smart", "Affordable", "Cost-Effective"],
    "evening": ["Night Owl", "After-Hours", "Evening Star"],
    "families": ["Family Corner", "Kid-Friendly", "Family Hub"],
    "leisure": ["Leisure Zone", "Fun Spot", "Activity Center"],
    "daily": ["Everyday", "Daily Stop", "Go-To"],
    "quick": ["Express", "Quick Stop", "Fast Track"],
    "premium": ["Premium", "Elite", "Prime"],
    "traffic": ["High Street", "Busy Corner", "Central"],
    "community": ["Neighborhood", "Local", "Community"],
  };

  // Find matching prefix based on opportunity type
  let prefix = "Business";
  const typeKey = opportunityType.toLowerCase();
  for (const [key, prefixes] of Object.entries(purposePrefixes)) {
    if (typeKey.includes(key)) {
      prefix = prefixes[index % prefixes.length];
      break;
    }
  }

  // Category-based suffix
  let suffix = "Spot";
  if (cat.includes("restaurant")) suffix = "Dining";
  else if (cat.includes("food")) suffix = "Food Hub";
  else if (cat.includes("retail")) suffix = "Store";
  else if (cat.includes("service")) suffix = "Services";
  else if (cat.includes("entertainment")) suffix = "Entertainment";
  else if (cat.includes("leisure")) suffix = "Lounge";

  // Use location for uniqueness if available
  const locationPart = location ? ` near ${location.split(",")[0]}` : "";

  return `${prefix} ${suffix}${locationPart}`;
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

  // 1. Density Score (higher density = higher accessibility = better)
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

  // 3. Zone Score (Commercial > Residential)
  let zoneScore = 0.5;
  const zone = loc.zone_type?.toLowerCase() || "";
  if (zone === "commercial") {
    zoneScore = 1.0;
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
    insights.push(`Accessibility: ${commercialPct}% high-access locations near main roads`);
  } else if (residentialPct > 50) {
    insights.push(`Accessibility: ${residentialPct}% residential zones — community-focused businesses recommended`);
  } else {
    insights.push(`Accessibility: Balanced mix — ${commercialPct}% high-access, ${residentialPct}% residential`);
  }

  // 6. HIGHEST DENSITY CLUSTER
  if (kpis.highestDensityCluster && kpis.highestDensityCluster.avgDensity > 0) {
    const denseLocs = locations.filter(loc => loc.cluster === kpis.highestDensityCluster?.clusterId);
    const denseStreet = denseLocs[0]?.street || `Cluster ${kpis.highestDensityCluster.clusterId}`;
    insights.push(`Highest activity: Near ${denseStreet} — ${kpis.highestDensityCluster.avgDensity} businesses nearby (high accessibility zone)`);
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

function buildCategoryStats(businesses: BusinessRow[], locations: LocationData[] = []): CategoryStat[] {
  const map = new Map<
    string,
    { count: number; totalDensity: number; totalCompetitors: number }
  >();

  // Use locations if available (enriched data), otherwise fallback to businesses
  const sourceData = locations.length > 0 ? locations : businesses;

  sourceData.forEach((b) => {
    // b can be BusinessRow or LocationData - they share these fields
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
  // gapScore now represents opportunity level (higher = more opportunity)
  // Thresholds adjusted for realistic market gap detection
  if (gapScore >= 5) return "High";    // Strong market opportunity
  if (gapScore >= 2) return "Medium";  // Moderate opportunity
  return "Low";                         // Market is balanced
}

function buildMarketGaps(
  businesses: BusinessRow[],
  opportunities: Opportunity[],
  locations: LocationData[] = []
): MarketGap[] {
  const map = new Map<
    string,
    { totalDemand: number; totalSupply: number; count: number; zones: string[] }
  >();

  // Use locations if available (they have computed densities), otherwise fallback to businesses
  const sourceData = locations.length > 0 ? locations : businesses;

  // Enhance source data with computed densities if stored values are 0
  const enhancedSource = sourceData.map((b) => {
    // If stored density is 0 or undefined, compute it dynamically
    if (!b.business_density_200m && !b.competitor_density_200m && locations.length > 0) {
      const { businessDensity, competitorDensity } = computeDynamicDensity(
        b as LocationData,
        locations,
        0.2 // 200m radius
      );
      return {
        ...b,
        business_density_200m: businessDensity,
        competitor_density_200m: competitorDensity,
      };
    }
    return b;
  });

  enhancedSource.forEach((b) => {
    // Both BusinessRow and LocationData have these fields
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
    // Calculate opportunity gap score using ratio-based formula
    // High demand (business activity) + Low supply (competitors) = High opportunity
    // Formula: demand / (supply + 1) gives higher scores for underserved markets
    const gapScore = Math.round((demand / (supply + 1)) * 2);

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
  const [showTopOpportunityDetails, setShowTopOpportunityDetails] = useState(false);
  const [expandedOpportunities, setExpandedOpportunities] = useState<Set<string>>(new Set());

  // Compare opportunities state
  const [selectedForCompare, setSelectedForCompare] = useState<BusinessOpportunity[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Toggle opportunity selection for comparison
  const toggleCompareSelection = (op: BusinessOpportunity) => {
    setSelectedForCompare(prev => {
      const isSelected = prev.some(o => o.name === op.name && o.score === op.score);
      if (isSelected) {
        return prev.filter(o => !(o.name === op.name && o.score === op.score));
      }
      if (prev.length >= 3) {
        return prev; // Max 3 selections
      }
      return [...prev, op];
    });
  };

  // Toggle expanded details for opportunity card
  const toggleOpportunityDetails = (key: string) => {
    setExpandedOpportunities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Preferences state
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [appliedPreferences, setAppliedPreferences] = useState<UserPreferences | null>(null);

  // Get kmeans store data early - needed for conditional data loading
  const kmeansStore = useKMeansStore();
  const aiRecommendations = kmeansStore.aiRecommendations;
  const hasClusteringResultsFromStore = kmeansStore.hasResults;

  // Load data from Supabase
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

  // Extract safe values from clustering results - ONLY if clustering was run in session
  // Use kmeansStore as the source of truth for whether to show data
  const businessType = kmeansStore.hasResults
    ? (kmeansStore.detectedCategory || clusteringResults?.business_category || "")
    : "";
  const numClusters = kmeansStore.hasResults
    ? (clusteringResults?.num_clusters ?? 0)
    : 0;
  const locations = kmeansStore.hasResults
    ? (clusteringResults?.locations || [])
    : [];

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
        : computeOpportunityScore(businessDensity, competitors, loc.zone_type || "Commercial");

      return {
        title: `${businessType || "Business"} near ${loc.street || "Unknown"}`,
        category: loc.general_category || "",
        location: loc.street || "Unknown",
        businessDensity,
        competitors,
        zone_type: loc.zone_type || "Commercial",
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
          zone_type: loc.zone_type || "Commercial",
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
        bestZone: "Commercial" as const,
        score: 0,
        reasoning: ["No opportunities available for analysis"],
        competitionLevel: "Low" as const,
        marketDemand: "Low" as const,
        accessibility: "Moderate" as const,
      };
    }
    const avgDensity = opportunities.reduce((sum, op) => sum + op.businessDensity, 0) / opportunities.length;
    const avgCompetitors = opportunities.reduce((sum, op) => sum + op.competitors, 0) / opportunities.length;
    const primaryZone = opportunities[0]?.zone_type || "Commercial";

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
    const primaryZone = opportunities[0]?.zone_type || "Commercial";

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

  const categoryStats = useMemo(() => buildCategoryStats(businesses, locations), [businesses, locations]);
  const zoneStats = useMemo(() => buildZoneStats(businesses), [businesses]);
  const totalBusinesses = businesses.length;
  const marketGaps = useMemo(() => buildMarketGaps(businesses, opportunities, locations), [businesses, opportunities, locations]);

  // Check if clustering has been run in the current session
  const hasClusteringResults = hasClusteringResultsFromStore;

  // Effective KPIs - show zeros if clustering hasn't been run
  const effectiveKPIs = useMemo(() => {
    if (!hasClusteringResults) {
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
    return clusterKPIs;
  }, [hasClusteringResults, clusterKPIs]);

  // Effective total businesses - only show count if clustering has been run
  // Active Businesses is always 100 - represents total registered businesses in the area
  const effectiveTotalBusinesses = 100;

  // Compute overall opportunity summary for Overview tab
  const overviewSummary = useMemo(() => {
    // Empty state when clustering hasn't been run
    if (!hasClusteringResults) {
      return {
        category: businessType || "General Business",
        overallScore: 0,
        overallScoreWhy: "",
        operatingTime: "N/A" as const,
        operatingTimeWhy: "",
        setupSpeed: "N/A" as const,
        setupSpeedWhy: "",
        competitionLevel: "N/A" as const,
        competitionLevelWhy: "",
        status: "Pending" as const,
        opportunityFocus: "Run clustering to see results",
        opportunityFocusWhy: "",
        areaReadiness: "N/A" as const,
        areaReadinessWhy: "",
        // New AI-powered fields
        marketSaturationPercent: 0,
        marketSaturationStatus: "N/A" as const,
        ideaFitScore: 0,
        ideaFitLabel: "N/A" as const,
        riskLevel: "N/A" as const,
        setupDifficulty: "N/A" as const,
        suggestedAdjustments: "",
        aiSummary: "",
      };
    }

    // Use AI marketOverview and ideaFit if available
    const aiMarket = aiRecommendations?.marketOverview;
    const aiIdea = aiRecommendations?.ideaFit;

    // Calculate fallback values
    const avgScore = opportunities.length > 0
      ? Math.round(opportunities.reduce((s, o) => s + o.score, 0) / opportunities.length)
      : 0;
    const avgDensity = clusterKPIs.avgBusinessDensity;
    const avgComp = clusterKPIs.avgCompetition;
    const category = businessType || "General Business";
    const commercialRatio = clusterKPIs.commercialZoneCount / Math.max(1, clusterKPIs.totalOpportunities);
    const residentialRatio = clusterKPIs.residentialZoneCount / Math.max(1, clusterKPIs.totalOpportunities);

    // Use AI score if available, otherwise calculate
    const overallScore = aiMarket?.overallScore ?? avgScore;

    // Generate score explanation
    let overallScoreWhy = aiMarket?.summary || "";
    if (!overallScoreWhy) {
      if (overallScore >= 70) {
        overallScoreWhy = `Strong demand for ${category.toLowerCase()} with limited competition nearby.`;
      } else if (overallScore >= 50) {
        overallScoreWhy = `Demand exists for ${category.toLowerCase()}, but similar businesses are already present nearby.`;
      } else {
        overallScoreWhy = `The area has moderate demand, but competition is higher than average.`;
      }
    }

    // Use AI competition level if available
    const competitionLevel = (aiMarket?.competitionLevel as "Low" | "Medium" | "High" | "N/A") ?? getCompetitionLevel(avgComp);
    let competitionLevelWhy = "";
    if (competitionLevel === "Low") {
      competitionLevelWhy = "Few similar businesses operate in this area, giving you an advantage.";
    } else if (competitionLevel === "Medium") {
      competitionLevelWhy = "Several businesses in the same category operate within the area.";
    } else {
      competitionLevelWhy = "Many competitors are already established in this location.";
    }

    // Determine best operating time from zone and category analysis
    let operatingTime: "Day" | "Evening" | "Both" | "N/A" = "Both";
    let operatingTimeWhy = "";
    if (commercialRatio > 0.7) {
      operatingTime = "Both";
      operatingTimeWhy = "Customer activity is spread across morning and evening based on clustering data.";
    } else if (residentialRatio > 0.6) {
      operatingTime = "Day";
      operatingTimeWhy = "Residential areas show higher daytime activity from local residents.";
    } else if (commercialRatio > 0.4 && residentialRatio < 0.3) {
      operatingTime = "Evening";
      operatingTimeWhy = "High-access areas show peak activity during evening hours.";
    } else {
      operatingTimeWhy = "Customer activity is spread across morning and evening based on clustering data.";
    }

    // Use AI setup difficulty if available, otherwise determine from category
    const setupSpeed = aiIdea?.setupDifficulty === "Easy" ? "Fast" as const :
      aiIdea?.setupDifficulty === "Complex" ? "Slow" as const :
        aiIdea?.setupDifficulty === "Moderate" ? "Moderate" as const :
          determineSetupSpeed(businessType);
    let setupSpeedWhy = "";
    if (setupSpeed === "Fast") {
      setupSpeedWhy = `${category} businesses require less space and lower setup time based on local patterns.`;
    } else if (setupSpeed === "Moderate") {
      setupSpeedWhy = `${category} businesses need moderate preparation time for equipment and permits.`;
    } else {
      setupSpeedWhy = `${category} businesses typically need longer setup time for proper establishment.`;
    }

    // Determine opportunity focus based on operating time and setup speed
    let opportunityFocus = "Best for quick setup";
    let opportunityFocusWhy = "";
    if (operatingTime === "Evening" && competitionLevel === "Low") {
      opportunityFocus = "Best for evening sales";
      opportunityFocusWhy = "Low competition during evening hours makes this ideal for after-work customers.";
    } else if (operatingTime === "Day" && competitionLevel === "Low") {
      opportunityFocus = "Best for daytime services";
      opportunityFocusWhy = "Daytime accessibility is high with few competitors serving the area.";
    } else if (setupSpeed === "Fast" && competitionLevel === "Low") {
      opportunityFocus = "Best for quick setup";
      opportunityFocusWhy = `${category} businesses require less space and lower setup time based on local patterns.`;
    } else if (avgDensity > 15) {
      opportunityFocus = "Best for high-traffic areas";
      opportunityFocusWhy = "High business density means more potential customers passing through.";
    } else if (competitionLevel === "Low") {
      opportunityFocus = "Best for first movers";
      opportunityFocusWhy = "Being first in the area gives you a head start before competitors arrive.";
    } else {
      opportunityFocusWhy = "This location offers balanced opportunities for various business approaches.";
    }

    // Use AI area readiness if available
    const areaReadiness = (aiMarket?.areaReadiness as "High" | "Medium" | "Low" | "N/A") ??
      (overallScore >= 70 && commercialRatio > 0.4 ? "High" :
        overallScore < 50 || commercialRatio < 0.2 ? "Low" : "Medium");
    let areaReadinessWhy = "";
    if (areaReadiness === "High") {
      areaReadinessWhy = "The area is well-developed with good infrastructure for your business type.";
    } else if (areaReadiness === "Low") {
      areaReadinessWhy = "The area may need more development before it fully supports your business.";
    } else {
      areaReadinessWhy = "The area supports the business type but may need minor preparation.";
    }

    // Get AI-specific values
    const marketSaturationPercent = aiMarket?.marketSaturationPercent ?? 0;
    const marketSaturationStatus = (aiMarket?.marketSaturationStatus as "Good Opportunity" | "Needs Strategic Planning" | "Highly Saturated" | "N/A") ?? "N/A";
    const ideaFitScore = aiIdea?.ideaFitScore ?? 0;
    const ideaFitLabel = (aiIdea?.fitLabel as "Highly Recommended" | "Good Choice" | "Fair Option" | "N/A") ?? "N/A";
    const riskLevel = (aiIdea?.riskLevel as "Low Risk" | "Medium Risk" | "High Risk" | "N/A") ?? "N/A";
    const setupDifficulty = (aiIdea?.setupDifficulty as "Easy" | "Moderate" | "Complex" | "N/A") ?? "N/A";
    const suggestedAdjustments = aiIdea?.suggestedAdjustments ?? "";
    const aiSummary = aiMarket?.summary ?? "";

    return {
      category,
      overallScore,
      overallScoreWhy,
      operatingTime,
      operatingTimeWhy,
      setupSpeed,
      setupSpeedWhy,
      competitionLevel,
      competitionLevelWhy,
      status: getStatusFromScore(overallScore),
      opportunityFocus,
      opportunityFocusWhy,
      areaReadiness,
      areaReadinessWhy,
      // New AI-powered fields
      marketSaturationPercent,
      marketSaturationStatus,
      ideaFitScore,
      ideaFitLabel,
      riskLevel,
      setupDifficulty,
      suggestedAdjustments,
      aiSummary,
    };
  }, [opportunities, clusterKPIs, businessType, hasClusteringResults, aiRecommendations]);

  // Group opportunities by category for the Opportunities tab
  const opportunitiesByCategory = useMemo(() => {
    const categories = new Map<string, BusinessOpportunity[]>();
    let globalIndex = 0; // Track across all opportunities for rotation

    // Add AI top businesses if available
    if (aiRecommendations?.topBusinesses) {
      aiRecommendations.topBusinesses.forEach((biz, idx) => {
        const cat = businessType || "General";
        if (!categories.has(cat)) categories.set(cat, []);

        const baseScore = biz.score || biz.fitPercentage || 70;
        const competitionLevel = biz.opportunityLevel?.includes("High") ? "Low" as const :
          biz.opportunityLevel?.includes("Low") ? "High" as const : "Medium" as const;
        const competitors = competitionLevel === "Low" ? 1 : competitionLevel === "Medium" ? 4 : 7;
        const density = 10; // Estimated for AI recommendations

        const score = calculateDistinctScore(baseScore, density, competitors, "", cat, globalIndex);
        const operatingTime = determineOperatingTime(biz.name, "");
        const setupSpeed = determineSetupSpeed(biz.name);
        const opportunityType = generateOpportunityType(competitors, density, "", cat, globalIndex);
        const primaryAdvantage = generatePrimaryAdvantage(competitors, density, "", globalIndex);
        const demandPattern = generateDemandPattern("", cat, globalIndex);
        const userFitLevel = calculateUserFitLevel(competitors, setupSpeed, score);
        const name = generatePurposeBasedName(cat, opportunityType, biz.preferredLocation || "", globalIndex);

        categories.get(cat)!.push({
          name,
          category: cat,
          score,
          status: getStatusFromScore(score),
          operatingTime,
          setupSpeed,
          competitionLevel,
          description: biz.shortDescription || biz.fullDetails,
          opportunityType,
          primaryAdvantage,
          demandPattern,
          userFitLevel,
          location: biz.preferredLocation,
        });

        globalIndex++;
      });
    }

    // Add opportunities from clustering results
    opportunities.forEach((op, idx) => {
      const cat = op.category || "General";
      if (!categories.has(cat)) categories.set(cat, []);

      const baseScore = op.score;
      const competitors = op.competitors;
      const density = op.businessDensity;
      const zoneType = op.zone_type;

      const score = calculateDistinctScore(baseScore, density, competitors, zoneType, cat, globalIndex);
      const operatingTime = determineOperatingTime(cat, zoneType);
      const setupSpeed = determineSetupSpeed(cat);
      const competitionLevel = getCompetitionLevel(competitors);
      const opportunityType = generateOpportunityType(competitors, density, zoneType, cat, globalIndex);
      const primaryAdvantage = generatePrimaryAdvantage(competitors, density, zoneType, globalIndex);
      const demandPattern = generateDemandPattern(zoneType, cat, globalIndex);
      const userFitLevel = calculateUserFitLevel(competitors, setupSpeed, score);
      const name = generatePurposeBasedName(cat, opportunityType, op.location, globalIndex);

      categories.get(cat)!.push({
        name,
        category: cat,
        score,
        status: getStatusFromScore(score),
        operatingTime,
        setupSpeed,
        competitionLevel,
        description: op.insights[0],
        opportunityType,
        primaryAdvantage,
        demandPattern,
        userFitLevel,
        location: op.location,
      });

      globalIndex++;
    });

    // Sort each category by score
    categories.forEach((opps, cat) => {
      opps.sort((a, b) => b.score - a.score);
      categories.set(cat, opps.slice(0, 10)); // Limit to top 10 per category
    });

    return categories;
  }, [opportunities, aiRecommendations, businessType]);

  // Compute top opportunity for focused display
  const topOpportunity = useMemo(() => {
    // Priority: AI recommendations first, then clustering opportunities
    const aiTop = aiRecommendations?.topBusinesses?.[0];
    const clusterTop = opportunities[0];

    if (aiTop) {
      const score = aiTop.score || aiTop.fitPercentage || 70;
      const status = getStatusFromScore(score);
      const competitionLevel = aiTop.opportunityLevel?.includes("High") ? "Low" as const :
        aiTop.opportunityLevel?.includes("Low") ? "High" as const : "Medium" as const;

      // Determine suggested business size based on density and competition
      const suggestedSize = competitionLevel === "Low" ? "Small / Medium" :
        competitionLevel === "Medium" ? "Medium" : "Medium / Large";

      // Why it stands out
      let whyStandsOut = "";
      if (competitionLevel === "Low" && score >= 75) {
        whyStandsOut = "Low competition with high potential for success";
      } else if (score >= 80) {
        whyStandsOut = "Excellent opportunity score indicates strong market fit";
      } else if (competitionLevel === "Low") {
        whyStandsOut = "Few competitors in this area means easier market entry";
      } else {
        whyStandsOut = "Good balance of customer traffic and manageable competition";
      }

      // Entry strategy based on competition
      const entryStrategy = competitionLevel === "Low"
        ? "First-mover advantage – establish your presence early before competitors arrive"
        : competitionLevel === "Medium"
          ? "Gradual entry – start small, build reputation, then expand"
          : "Differentiation focus – offer unique value to stand out from existing businesses";

      // Risk summary
      const riskSummary = competitionLevel === "Low" && score >= 70
        ? "Low risk – favorable conditions for new business entry."
        : competitionLevel === "High"
          ? "Moderate risk – success depends on strong differentiation."
          : "Standard risk – typical market conditions apply.";

      // Location fit
      const locationFit = aiTop.preferredLocation
        ? `This location suits ${aiTop.name} because ${aiTop.preferredLocation.toLowerCase()}.`
        : `This area has good accessibility and visibility for ${aiTop.name}.`;

      return {
        name: aiTop.name,
        score,
        status,
        operatingTime: determineOperatingTime(aiTop.name, ""),
        setupSpeed: determineSetupSpeed(aiTop.name),
        competitionLevel,
        suggestedSize,
        whyStandsOut,
        description: aiTop.shortDescription || aiTop.fullDetails || `A ${aiTop.name.toLowerCase()} business tailored for this location.`,
        operatingHours: aiTop.name.toLowerCase().includes("restaurant") || aiTop.name.toLowerCase().includes("food")
          ? "10:00 AM – 10:00 PM (flexible based on customer demand)"
          : "8:00 AM – 6:00 PM (standard business hours)",
        entryStrategy,
        riskSummary,
        locationFit,
        startupBudget: aiTop.startupBudget || "Varies based on scale",
      };
    }

    if (clusterTop) {
      const status = getStatusFromScore(clusterTop.score);
      const competitionLevel = getCompetitionLevel(clusterTop.competitors);
      const suggestedSize = clusterTop.businessDensity >= 15 ? "Medium / Large" :
        clusterTop.businessDensity >= 8 ? "Small / Medium" : "Small";

      let whyStandsOut = "";
      if (clusterTop.competitors === 0) {
        whyStandsOut = "No direct competitors nearby – great for first movers";
      } else if (clusterTop.score >= 80) {
        whyStandsOut = "High opportunity score with balanced market conditions";
      } else if (clusterTop.businessDensity >= 15) {
        whyStandsOut = "High accessibility area with strong customer potential";
      } else {
        whyStandsOut = "Good location with room for growth";
      }

      const entryStrategy = competitionLevel === "Low"
        ? "First-mover advantage – establish your presence early"
        : competitionLevel === "Medium"
          ? "Gradual entry – start small and build your customer base"
          : "Focus on differentiation to stand out";

      const riskSummary = competitionLevel === "Low" && clusterTop.score >= 70
        ? "Low risk – favorable conditions for new business entry."
        : competitionLevel === "High"
          ? "Moderate risk – requires strong value proposition."
          : "Standard risk – typical market conditions.";

      return {
        name: clusterTop.title,
        score: clusterTop.score,
        status,
        operatingTime: determineOperatingTime(clusterTop.category, clusterTop.zone_type),
        setupSpeed: determineSetupSpeed(clusterTop.category),
        competitionLevel,
        suggestedSize,
        whyStandsOut,
        description: clusterTop.insights[0] || `Business opportunity in ${clusterTop.location}.`,
        operatingHours: "8:00 AM – 6:00 PM (adjust based on zone activity)",
        entryStrategy,
        riskSummary,
        locationFit: `Located in a ${clusterTop.zone_type.toLowerCase()} zone with ${clusterTop.businessDensity} nearby businesses.`,
        startupBudget: "Varies based on business type",
      };
    }

    return null;
  }, [aiRecommendations, opportunities]);

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

  // Compute time-based gaps data for Market Gaps tab
  const timeBasedGapsData = useMemo((): TimeBasedGapsResult => {
    // If no recommendation data (opportunities), return default data
    if (clusterKPIs.totalOpportunities === 0 || categoryStats.length === 0) {
      return getDefaultTimeBasedGaps(businessType || "Selected Area");
    }

    // Build category distribution from categoryStats
    const categoryDist = categoryStats.map(c => ({ name: c.category, count: c.count }));

    // Estimate morning vs evening businesses based on category types
    const morningCategories = ["Convenience Store", "Bakery", "Retail", "Services", "Healthcare"];
    const eveningCategories = ["Restaurant", "Food Stall", "Fast Food", "Entertainment", "Bar"];

    let morningCount = 0;
    let eveningCount = 0;
    const morningCats: string[] = [];
    const eveningCats: string[] = [];

    categoryDist.forEach(({ name, count }) => {
      const isMorning = morningCategories.some(mc =>
        name.toLowerCase().includes(mc.toLowerCase())
      );
      const isEvening = eveningCategories.some(ec =>
        name.toLowerCase().includes(ec.toLowerCase())
      );

      if (isMorning) {
        morningCount += count;
        if (!morningCats.includes(name) && morningCats.length < 2) morningCats.push(name);
      }
      if (isEvening) {
        eveningCount += count;
        if (!eveningCats.includes(name) && eveningCats.length < 2) eveningCats.push(name);
      }
      // Some businesses operate both periods
      if (!isMorning && !isEvening) {
        morningCount += Math.floor(count * 0.6);
        eveningCount += Math.floor(count * 0.4);
      }
    });

    // Normalize density to a  demand score
    const baseDemandScore = Math.min(100, Math.round((clusterKPIs.avgBusinessDensity / 20) * 100));

    return generateTimeBasedGaps({
      location: businessType || "Selected Area",
      morning: {
        businessCount: morningCount,
        mainCategories: morningCats.length > 0 ? morningCats : ["General Retail"],
        demandScore: Math.min(100, baseDemandScore + 5),
        operatingHours: "8AM – 5PM",
      },
      evening: {
        businessCount: eveningCount,
        mainCategories: eveningCats.length > 0 ? eveningCats : ["Food", "Services"],
        demandScore: baseDemandScore,
        operatingHours: "6PM – 12AM",
      },
    });
  }, [clusterKPIs, categoryStats, businessType]);

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
      "High-Access Locations": cluster.commercialCount,
      "Residential Zones": cluster.residentialCount,
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
      ["Accessibility Score", clusterKPIs.commercialZoneCount >= 40 ? "High" : clusterKPIs.commercialZoneCount >= 20 ? "Medium" : "Low"],
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
          </div>
          <div className="flex flex-wrap gap-3 mt-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm">
              <Store className="w-4 h-4" />
              <span className="text-sm font-medium">{effectiveKPIs.totalOpportunities} Opportunities</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm" title="Total businesses recorded in the system">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium">{effectiveTotalBusinesses} Active Businesses</span>
            </div>

            {/* Action Buttons */}
            <div className="flex-1 flex justify-end gap-2">
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
            <div className="text-4xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{effectiveKPIs.totalOpportunities}</div>
            <p className="text-xs text-gray-500 mt-1">{hasClusteringResults ? "Identified locations" : "Run clustering to see results"}</p>
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
            <div className="text-4xl font-bold bg-linear-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">{effectiveKPIs.avgBusinessDensity}</div>
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
            <div className="text-4xl font-bold bg-linear-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">{effectiveKPIs.avgCompetition}</div>
            <p className="text-xs text-gray-500 mt-1">Competitors nearby</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden group hover:shadow-xl transition-all hover:scale-[1.02]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Accessibility</CardTitle>
              <div className="p-2 bg-linear-to-br from-purple-500 to-violet-600 rounded-lg text-white shadow-lg shadow-purple-200">
                <MapPin className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold bg-linear-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
              {effectiveKPIs.commercialZoneCount >= 40 ? "High" : effectiveKPIs.commercialZoneCount >= 20 ? "Medium" : hasClusteringResults ? "Low" : "—"}
            </div>
            <p className="text-xs text-gray-500 mt-1">Based on road proximity</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full h-14 bg-white/80 backdrop-blur-sm shadow-lg rounded-xl p-1.5">
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
          {/* ARCHIVED: History tab hidden for now
          <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-linear-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg font-medium transition-all">
            History
          </TabsTrigger>
          */}
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
                  <h2 className="text-2xl font-bold tracking-tight">
                    {hasClusteringResults ? overviewSummary.category : "—"}
                  </h2>
                </div>
              </div>
              <p className="text-indigo-100 text-sm leading-relaxed">
                {hasClusteringResults
                  ? `Based on our location analysis, this area shows ${overviewSummary.status === "Strong" ? "excellent" : overviewSummary.status === "Good" ? "promising" : "moderate"} potential for ${overviewSummary.category} opportunities. The recommended zones have ${overviewSummary.competitionLevel.toLowerCase()} competition and are best suited for ${overviewSummary.operatingTime === "Both" ? "all-day" : overviewSummary.operatingTime.toLowerCase()} operations.`
                  : "Run clustering to see opportunity insights."}
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
                  {hasClusteringResults ? `${overviewSummary.overallScore}%` : "0%"}
                </div>
                {hasClusteringResults && (
                  <Badge className={`mt-2 ${overviewSummary.status === "Strong" ? "bg-emerald-100 text-emerald-700" : overviewSummary.status === "Good" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                    {overviewSummary.status} Opportunity
                  </Badge>
                )}
                <p className="text-xs text-gray-400 mt-2">Overall attractiveness based on competition and feasibility</p>
              </CardContent>
            </Card>

            {/* Operating Time */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all hover:scale-[1.02]">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-linear-to-br from-amber-500 to-orange-600 rounded-lg text-white">
                    {hasClusteringResults && overviewSummary.operatingTime === "Day" ? <Sun className="w-5 h-5" /> :
                      hasClusteringResults && overviewSummary.operatingTime === "Evening" ? <Moon className="w-5 h-5" /> :
                        <Clock className="w-5 h-5" />}
                  </div>
                  <span className="text-sm font-medium text-gray-600">Best Operating Time</span>
                </div>
                <div className="text-2xl font-bold text-gray-800">
                  {hasClusteringResults ? overviewSummary.operatingTime : "—"}
                </div>
                {hasClusteringResults && (
                  <p className="text-xs text-gray-500 mt-1">
                    {overviewSummary.operatingTime === "Both" ? "All-day operations recommended" :
                      overviewSummary.operatingTime === "Day" ? "Morning to afternoon peak" :
                        "Afternoon to night peak"}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">Based on surrounding business activity patterns</p>
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
                <div className="text-2xl font-bold text-gray-800">
                  {hasClusteringResults ? overviewSummary.setupSpeed : "—"}
                </div>
                {hasClusteringResults && (
                  <p className="text-xs text-gray-500 mt-1">
                    {overviewSummary.setupSpeed === "Fast" ? "Can open within weeks" :
                      overviewSummary.setupSpeed === "Moderate" ? "1-2 months preparation" :
                        "3+ months setup time"}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">Expected timeline based on zone and requirements</p>
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
                <div className="text-2xl font-bold text-gray-800">
                  {hasClusteringResults ? overviewSummary.competitionLevel : "—"}
                </div>
                {hasClusteringResults && (
                  <Badge className={`mt-1 ${overviewSummary.competitionLevel === "Low" ? "bg-emerald-100 text-emerald-700" : overviewSummary.competitionLevel === "Medium" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                    {overviewSummary.competitionLevel === "Low" ? "Easy entry" : overviewSummary.competitionLevel === "Medium" ? "Some rivals" : "Crowded market"}
                  </Badge>
                )}
                <p className="text-xs text-gray-400 mt-2">Similar businesses operating nearby</p>
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
                <div className="text-lg font-bold text-gray-800">
                  {hasClusteringResults ? overviewSummary.opportunityFocus : "—"}
                </div>
                {hasClusteringResults && (
                  <p className="text-xs text-gray-500 mt-1">Based on local conditions</p>
                )}
                <p className="text-xs text-gray-400 mt-2">Type of advantage this location offers</p>
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
                <div className="text-2xl font-bold text-gray-800">
                  {hasClusteringResults ? overviewSummary.areaReadiness : "—"}
                </div>
                {hasClusteringResults && (
                  <Badge className={`mt-1 ${overviewSummary.areaReadiness === "High" ? "bg-emerald-100 text-emerald-700" : overviewSummary.areaReadiness === "Medium" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                    {overviewSummary.areaReadiness === "High" ? "Ready for business" : overviewSummary.areaReadiness === "Medium" ? "Some preparation needed" : "Requires development"}
                  </Badge>
                )}
                <p className="text-xs text-gray-400 mt-2">How prepared the area is for operations</p>
              </CardContent>
            </Card>
          </div>

          {/* AI-Powered Dual-View Section */}
          {hasClusteringResults && aiRecommendations?.marketOverview && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                AI Market Analysis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Market Saturation */}
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all hover:scale-[1.02]">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg text-white ${overviewSummary.marketSaturationStatus === "Good Opportunity" ? "bg-gradient-to-br from-emerald-500 to-green-600" :
                        overviewSummary.marketSaturationStatus === "Needs Strategic Planning" ? "bg-gradient-to-br from-amber-500 to-yellow-600" :
                          "bg-gradient-to-br from-rose-500 to-red-600"
                        }`}>
                        <Activity className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium text-gray-600">Market Saturation</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-800">
                      {overviewSummary.marketSaturationPercent}%
                    </div>
                    <Badge className={`mt-1 ${overviewSummary.marketSaturationStatus === "Good Opportunity" ? "bg-emerald-100 text-emerald-700" :
                      overviewSummary.marketSaturationStatus === "Needs Strategic Planning" ? "bg-amber-100 text-amber-700" :
                        "bg-rose-100 text-rose-700"
                      }`}>
                      {overviewSummary.marketSaturationStatus !== "N/A" ? overviewSummary.marketSaturationStatus : "—"}
                    </Badge>
                    <p className="text-xs text-gray-400 mt-2">
                      {overviewSummary.marketSaturationStatus === "Good Opportunity"
                        ? "Low competition — ideal for new business"
                        : overviewSummary.marketSaturationStatus === "Needs Strategic Planning"
                          ? "Moderate — differentiation needed"
                          : "High competition — requires strong advantage"}
                    </p>
                  </CardContent>
                </Card>

                {/* Idea Fit Score */}
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all hover:scale-[1.02]">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg text-white ${overviewSummary.ideaFitLabel === "Highly Recommended" ? "bg-gradient-to-br from-emerald-500 to-green-600" :
                        overviewSummary.ideaFitLabel === "Good Choice" ? "bg-gradient-to-br from-blue-500 to-indigo-600" :
                          "bg-gradient-to-br from-amber-500 to-orange-600"
                        }`}>
                        <Lightbulb className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium text-gray-600">Your Idea Fit</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-800">
                      {overviewSummary.ideaFitScore > 0 ? `${overviewSummary.ideaFitScore}%` : "—"}
                    </div>
                    {overviewSummary.ideaFitLabel !== "N/A" && (
                      <Badge className={`mt-1 ${overviewSummary.ideaFitLabel === "Highly Recommended" ? "bg-emerald-100 text-emerald-700" :
                        overviewSummary.ideaFitLabel === "Good Choice" ? "bg-blue-100 text-blue-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                        {overviewSummary.ideaFitLabel}
                      </Badge>
                    )}
                    <p className="text-xs text-gray-400 mt-2">How well your business idea fits this location</p>
                  </CardContent>
                </Card>

                {/* Risk Level */}
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all hover:scale-[1.02]">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg text-white ${overviewSummary.riskLevel === "Low Risk" ? "bg-gradient-to-br from-emerald-500 to-green-600" :
                        overviewSummary.riskLevel === "Medium Risk" ? "bg-gradient-to-br from-amber-500 to-yellow-600" :
                          "bg-gradient-to-br from-rose-500 to-red-600"
                        }`}>
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium text-gray-600">Risk Level</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-800">
                      {overviewSummary.riskLevel !== "N/A" ? overviewSummary.riskLevel : "—"}
                    </div>
                    {overviewSummary.riskLevel !== "N/A" && (
                      <Badge className={`mt-1 ${overviewSummary.riskLevel === "Low Risk" ? "bg-emerald-100 text-emerald-700" :
                        overviewSummary.riskLevel === "Medium Risk" ? "bg-amber-100 text-amber-700" :
                          "bg-rose-100 text-rose-700"
                        }`}>
                        {overviewSummary.riskLevel === "Low Risk" ? "Safe investment" :
                          overviewSummary.riskLevel === "Medium Risk" ? "Manageable risk" : "Proceed with caution"}
                      </Badge>
                    )}
                    <p className="text-xs text-gray-400 mt-2">Based on competition and market conditions</p>
                  </CardContent>
                </Card>
              </div>

              {/* AI Suggestion Box */}
              {overviewSummary.suggestedAdjustments && (
                <Card className="mt-4 border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg text-white shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 mb-1">AI Suggestion</h4>
                        <p className="text-sm text-gray-600">{overviewSummary.suggestedAdjustments}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Opportunity Cards Explained */}
          {hasClusteringResults && (
            <Card className="mt-6 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-slate-500 to-gray-600 rounded-lg text-white">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Opportunity Cards Explained</CardTitle>
                    <p className="text-sm text-gray-500">Understanding what each metric means</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h5 className="font-semibold text-gray-800 mb-2">📊 Opportunity Score</h5>
                    <p className="text-gray-600">Overall area potential based on business density, competition, and readiness.</p>
                    <p className="text-xs text-gray-500 mt-2 italic">Example: 54% = moderate potential with room for improvement.</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h5 className="font-semibold text-gray-800 mb-2">🕐 Best Operating Time</h5>
                    <p className="text-gray-600">When businesses are most active in the area based on surrounding activity.</p>
                    <p className="text-xs text-gray-500 mt-2 italic">Example: "Both" = all-day operations recommended.</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h5 className="font-semibold text-gray-800 mb-2">⚡ Setup Speed</h5>
                    <p className="text-gray-600">Estimated time to start operating: Fast (2-4 weeks), Moderate (1-2 months), Slow (3-6 months).</p>
                    <p className="text-xs text-gray-500 mt-2 italic">Example: "Fast" = minimal preparation needed.</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h5 className="font-semibold text-gray-800 mb-2">👥 Competition Level</h5>
                    <p className="text-gray-600">How many similar businesses operate nearby. Low = stable in 1-2 months, Medium = 3-6 months, High = 6-12 months.</p>
                    <p className="text-xs text-gray-500 mt-2 italic">Example: "Medium" = some competitors exist but market is not overcrowded.</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h5 className="font-semibold text-gray-800 mb-2">🎯 Opportunity Focus</h5>
                    <p className="text-gray-600">The main advantage this location offers for your business type.</p>
                    <p className="text-xs text-gray-500 mt-2 italic">Example: "Best for quick setup" = location supports faster business entry.</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h5 className="font-semibold text-gray-800 mb-2">✅ Area Readiness</h5>
                    <p className="text-gray-600">How prepared the area is: High (2-4 weeks), Medium (1-3 months), Low (3-6 months).</p>
                    <p className="text-xs text-gray-500 mt-2 italic">Example: "Medium" = some preparation needed before opening.</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-4 text-center">
                  * Accessibility is used as a proxy for visibility. Locations closer to main roads and intersections are generally easier for customers to reach.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>


        {/* OPPORTUNITIES TAB */}
        <TabsContent value="opportunities" className="space-y-6">
          {/* Empty State - No Clustering */}
          {!hasClusteringResults ? (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <div className="p-4 bg-amber-100 rounded-full w-fit mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No opportunities detected yet</h3>
                <p className="text-gray-500">Run clustering to identify opportunities.</p>
              </CardContent>
            </Card>
          ) : (
            <>
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

              {/* Your Preferences Panel */}
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden">
                <CardHeader
                  className="bg-linear-to-r from-indigo-50 to-purple-50 border-b cursor-pointer hover:bg-linear-to-r hover:from-indigo-100 hover:to-purple-100 transition-all"
                  onClick={() => setShowPreferencesModal(!showPreferencesModal)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-linear-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Your Preferences</CardTitle>
                        <p className="text-sm text-gray-500">
                          {appliedPreferences ? "Preferences applied – opportunities ranked by your fit" : "Set your preferences to find the best opportunities for you"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {appliedPreferences && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-0">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Applied
                        </Badge>
                      )}
                      <div className={`transition-transform ${showPreferencesModal ? "rotate-180" : ""}`}>
                        <TrendingUp className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                </CardHeader>

                {showPreferencesModal && (
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {/* Operating Time */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Clock className="w-4 h-4 inline mr-1" />
                          Preferred Operating Time
                        </label>
                        <select
                          value={preferences.businessType.includes("Evening") ? "Evening" : preferences.businessType.includes("Day") ? "Day" : "Both"}
                          onChange={(e) => setPreferences({ ...preferences, businessType: e.target.value })}
                          className="w-full p-3 border rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="Both">All Day (Flexible)</option>
                          <option value="Day">Daytime Only</option>
                          <option value="Evening">Evening / Night</option>
                        </select>
                      </div>

                      {/* Setup Speed */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Rocket className="w-4 h-4 inline mr-1" />
                          Desired Setup Speed
                        </label>
                        <select
                          value={preferences.competitorTolerance === "Low" ? "Fast" : preferences.competitorTolerance === "High" ? "Slow" : "Moderate"}
                          onChange={(e) => {
                            const speed = e.target.value;
                            setPreferences({ ...preferences, competitorTolerance: speed === "Fast" ? "Low" : speed === "Slow" ? "High" : "Medium" });
                          }}
                          className="w-full p-3 border rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="Fast">Fast (Quick Start)</option>
                          <option value="Moderate">Moderate</option>
                          <option value="Slow">Slow (Complex Setup)</option>
                        </select>
                      </div>

                      {/* Risk Tolerance */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <AlertTriangle className="w-4 h-4 inline mr-1" />
                          Risk Tolerance
                        </label>
                        <select
                          value={preferences.customerPriority < 40 ? "Low" : preferences.customerPriority > 60 ? "High" : "Medium"}
                          onChange={(e) => {
                            const risk = e.target.value;
                            setPreferences({ ...preferences, customerPriority: risk === "Low" ? 30 : risk === "High" ? 80 : 50 });
                          }}
                          className="w-full p-3 border rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="Low">Low Risk (Safe Choices)</option>
                          <option value="Medium">Medium Risk</option>
                          <option value="High">High Risk (Higher Reward)</option>
                        </select>
                      </div>

                      {/* Business Size */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Building2 className="w-4 h-4 inline mr-1" />
                          Business Size Preference
                        </label>
                        <select
                          value={preferences.startupCapital < 50000 ? "Small" : preferences.startupCapital > 150000 ? "Large" : "Medium"}
                          onChange={(e) => {
                            const size = e.target.value;
                            setPreferences({ ...preferences, startupCapital: size === "Small" ? 30000 : size === "Large" ? 200000 : 100000 });
                          }}
                          className="w-full p-3 border rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="Small">Small (Home-based / Kiosk)</option>
                          <option value="Medium">Medium (Storefront)</option>
                          <option value="Large">Large (Full Establishment)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
                      <p className="text-sm text-gray-500">
                        Preferences will re-rank opportunities to show your best matches first.
                      </p>
                      <div className="flex gap-3">
                        {appliedPreferences && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setAppliedPreferences(null);
                              setPreferences(DEFAULT_PREFERENCES);
                            }}
                            className="rounded-xl"
                          >
                            Clear Preferences
                          </Button>
                        )}
                        <Button
                          onClick={() => {
                            setAppliedPreferences(preferences);
                            setShowPreferencesModal(false);
                          }}
                          className="bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl shadow-lg"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Apply Preferences
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Best Match Explanation - Shown when preferences are applied */}
              {appliedPreferences && topOpportunity && (
                <Card className="border-0 shadow-xl bg-linear-to-r from-emerald-50 to-teal-50 overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-linear-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-lg">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-800 mb-2">
                          Best Match: {topOpportunity.name}
                        </h3>
                        <p className="text-gray-600 mb-4">
                          This opportunity matches your preference for {
                            preferences.competitorTolerance === "Low" ? "quick setup" :
                              preferences.competitorTolerance === "High" ? "thorough preparation" : "balanced setup"
                          } and {
                            preferences.businessType.includes("Evening") ? "evening operation" :
                              preferences.businessType.includes("Day") ? "daytime operation" : "flexible all-day operation"
                          }, with {
                            topOpportunity.competitionLevel.toLowerCase()
                          } competition and {
                            topOpportunity.operatingTime === "Both" ? "steady all-day" :
                              topOpportunity.operatingTime === "Evening" ? "evening-focused" : "daytime"
                          } demand.
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="p-3 bg-white rounded-lg border">
                            <p className="text-xs text-gray-500 mb-1">Match Score</p>
                            <p className="font-bold text-emerald-600">{topOpportunity.score}%</p>
                          </div>
                          <div className="p-3 bg-white rounded-lg border">
                            <p className="text-xs text-gray-500 mb-1">Best Time</p>
                            <p className="font-semibold text-gray-700">{topOpportunity.operatingTime}</p>
                          </div>
                          <div className="p-3 bg-white rounded-lg border">
                            <p className="text-xs text-gray-500 mb-1">Setup Speed</p>
                            <p className="font-semibold text-gray-700">{topOpportunity.setupSpeed}</p>
                          </div>
                          <div className="p-3 bg-white rounded-lg border">
                            <p className="text-xs text-gray-500 mb-1">Risk Level</p>
                            <p className={`font-semibold ${topOpportunity.competitionLevel === "Low" ? "text-emerald-600" : topOpportunity.competitionLevel === "Medium" ? "text-amber-600" : "text-rose-600"}`}>
                              {topOpportunity.competitionLevel === "Low" ? "Low Risk" : topOpportunity.competitionLevel === "Medium" ? "Medium Risk" : "Higher Risk"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

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

              {/* Top Opportunity – Details */}
              {topOpportunity && (
                <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
                  <CardHeader className="bg-linear-to-r from-emerald-50 to-teal-50 border-b">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-linear-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-lg shadow-emerald-200">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Top Opportunity – Details</CardTitle>
                        <p className="text-sm text-gray-500">Your best business opportunity based on location analysis</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {/* Main content */}
                    <div className="flex items-start justify-between flex-wrap gap-6">
                      {/* Left side - Business info */}
                      <div className="flex-1 min-w-[280px]">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`flex items-center justify-center w-12 h-12 rounded-xl text-white font-bold shadow-lg ${topOpportunity.status === "Strong" ? "bg-linear-to-br from-emerald-500 to-green-600" : topOpportunity.status === "Good" ? "bg-linear-to-br from-blue-500 to-indigo-600" : "bg-linear-to-br from-amber-500 to-orange-600"}`}>
                            #1
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-800">{topOpportunity.name}</h3>
                            <p className="text-sm text-gray-500">{topOpportunity.description}</p>
                          </div>
                        </div>

                        {/* Why It Stands Out */}
                        <div className="p-4 rounded-xl bg-linear-to-r from-amber-50 to-orange-50 border border-amber-100 mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="w-5 h-5 text-amber-600" />
                            <span className="font-semibold text-gray-700">Why This Stands Out</span>
                          </div>
                          <p className="text-gray-600">{topOpportunity.whyStandsOut}</p>
                        </div>

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="p-3 rounded-lg bg-gray-50 border">
                            <div className="flex items-center gap-2 mb-1">
                              {topOpportunity.operatingTime === "Day" ? <Sun className="w-4 h-4 text-amber-500" /> :
                                topOpportunity.operatingTime === "Evening" ? <Moon className="w-4 h-4 text-indigo-500" /> :
                                  <Clock className="w-4 h-4 text-blue-500" />}
                              <span className="text-xs text-gray-500">Best Time</span>
                            </div>
                            <span className="font-semibold text-gray-700">{topOpportunity.operatingTime}</span>
                          </div>

                          <div className="p-3 rounded-lg bg-gray-50 border">
                            <div className="flex items-center gap-2 mb-1">
                              <Rocket className="w-4 h-4 text-emerald-500" />
                              <span className="text-xs text-gray-500">Setup Speed</span>
                            </div>
                            <span className="font-semibold text-gray-700">{topOpportunity.setupSpeed}</span>
                          </div>

                          <div className="p-3 rounded-lg bg-gray-50 border">
                            <div className="flex items-center gap-2 mb-1">
                              <Users className="w-4 h-4 text-rose-500" />
                              <span className="text-xs text-gray-500">Competition</span>
                            </div>
                            <span className={`font-semibold ${topOpportunity.competitionLevel === "Low" ? "text-emerald-600" : topOpportunity.competitionLevel === "Medium" ? "text-amber-600" : "text-rose-600"}`}>
                              {topOpportunity.competitionLevel}
                            </span>
                          </div>

                          <div className="p-3 rounded-lg bg-gray-50 border">
                            <div className="flex items-center gap-2 mb-1">
                              <Building2 className="w-4 h-4 text-blue-500" />
                              <span className="text-xs text-gray-500">Suggested Size</span>
                            </div>
                            <span className="font-semibold text-gray-700">{topOpportunity.suggestedSize}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right side - Score and Action */}
                      <div className="flex flex-col items-center gap-4 min-w-[160px]">
                        <div className="text-center">
                          <div className="text-5xl font-bold bg-linear-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                            {topOpportunity.score}%
                          </div>
                          <p className="text-sm text-gray-500 mt-1">Opportunity Score</p>
                          <Badge className={`mt-2 ${topOpportunity.status === "Strong" ? "bg-emerald-100 text-emerald-700" : topOpportunity.status === "Good" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                            {topOpportunity.status} Opportunity
                          </Badge>
                        </div>

                        <Button
                          onClick={() => setShowTopOpportunityDetails(true)}
                          className="w-full bg-linear-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-200 transition-all hover:scale-[1.02]"
                        >
                          <Target className="w-4 h-4 mr-2" />
                          View More Info
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* View More Info Modal */}
              {showTopOpportunityDetails && topOpportunity && (
                <>
                  <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                    onClick={() => setShowTopOpportunityDetails(false)}
                  />
                  <div className="fixed z-50 bg-white p-8 rounded-2xl shadow-2xl w-[520px] max-h-[85vh] overflow-y-auto top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    {/* Modal Header */}
                    <div className="flex items-center gap-3 mb-6">
                      <div className={`flex items-center justify-center w-12 h-12 rounded-xl text-white font-bold shadow-lg ${topOpportunity.status === "Strong" ? "bg-linear-to-br from-emerald-500 to-green-600" : topOpportunity.status === "Good" ? "bg-linear-to-br from-blue-500 to-indigo-600" : "bg-linear-to-br from-amber-500 to-orange-600"}`}>
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-800">{topOpportunity.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-2xl font-bold text-emerald-600">{topOpportunity.score}%</span>
                          <Badge className={`${topOpportunity.status === "Strong" ? "bg-emerald-100 text-emerald-700" : topOpportunity.status === "Good" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                            {topOpportunity.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Business Concept */}
                    <div className="mb-5">
                      <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Store className="w-4 h-4 text-blue-500" />
                        Business Concept
                      </h3>
                      <p className="text-gray-600 bg-gray-50 p-4 rounded-lg">{topOpportunity.description}</p>
                    </div>

                    {/* Recommended Operating Hours */}
                    <div className="mb-5">
                      <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        Recommended Operating Hours
                      </h3>
                      <p className="text-gray-600 bg-amber-50 p-4 rounded-lg border border-amber-100">
                        {topOpportunity.operatingHours}
                      </p>
                    </div>

                    {/* Entry Strategy */}
                    <div className="mb-5">
                      <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Rocket className="w-4 h-4 text-emerald-500" />
                        Entry Strategy
                      </h3>
                      <p className="text-gray-600 bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                        {topOpportunity.entryStrategy}
                      </p>
                    </div>

                    {/* Risk Summary */}
                    <div className="mb-5">
                      <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        Risk Summary
                      </h3>
                      <p className="text-gray-600 bg-rose-50 p-4 rounded-lg border border-rose-100">
                        {topOpportunity.riskSummary}
                      </p>
                    </div>

                    {/* Why This Location Fits */}
                    <div className="mb-6">
                      <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-indigo-500" />
                        Why This Location Fits
                      </h3>
                      <p className="text-gray-600 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                        {topOpportunity.locationFit}
                      </p>
                    </div>

                    {/* Close Button */}
                    <Button
                      className="w-full h-12 bg-linear-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white rounded-xl"
                      onClick={() => setShowTopOpportunityDetails(false)}
                    >
                      Close
                    </Button>
                  </div>
                </>
              )}

              {/* Recommended for You - Personalized Insights */}
              <RecommendedForYou
                businessType={businessType}
                competitionLevel={overviewSummary.competitionLevel === "N/A" ? "Medium" : overviewSummary.competitionLevel}
                zoneType={zoneAnalysisData.zoneType}
                activityTime={overviewSummary.operatingTime === "N/A" ? "Both" : overviewSummary.operatingTime}
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
                      {opps.slice(0, showAll ? opps.length : 5).map((op, index) => {
                        const isSelected = selectedForCompare.some(o => o.name === op.name && o.score === op.score);
                        return (
                          <div
                            key={index}
                            className={`p-5 rounded-xl border-2 bg-white hover:shadow-lg transition-all ${isSelected ? "ring-2 ring-indigo-500" : ""}`}
                            style={{ borderColor: isSelected ? "#6366f1" : op.status === "Strong" ? "#10b98130" : op.status === "Good" ? "#3b82f630" : "#f59e0b30" }}
                          >
                            {/* Top Row: Checkbox, Rank, Name, Score */}
                            <div className="flex items-start justify-between gap-4 mb-4">
                              <div className="flex items-start gap-3">
                                {/* Compare Checkbox */}
                                <button
                                  onClick={() => toggleCompareSelection(op)}
                                  className={`flex items-center justify-center w-6 h-6 rounded border-2 transition-all flex-shrink-0 mt-2 ${isSelected
                                    ? "bg-indigo-500 border-indigo-500 text-white"
                                    : "border-gray-300 hover:border-indigo-400"
                                    }`}
                                  title={isSelected ? "Remove from comparison" : selectedForCompare.length >= 3 ? "Max 3 items" : "Add to comparison"}
                                >
                                  {isSelected && <CheckCircle2 className="w-4 h-4" />}
                                </button>
                                <div className={`flex items-center justify-center w-10 h-10 rounded-xl text-white font-bold shadow-lg flex-shrink-0 ${op.status === "Strong" ? "bg-linear-to-br from-emerald-500 to-green-600" : op.status === "Good" ? "bg-linear-to-br from-blue-500 to-indigo-600" : "bg-linear-to-br from-amber-500 to-orange-600"}`}>
                                  {index + 1}
                                </div>
                                <div>
                                  <h4 className="font-bold text-gray-800">{op.name}</h4>
                                  {op.location && <p className="text-xs text-gray-400 mt-0.5">{op.location}</p>}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <div className={`text-2xl font-bold ${op.status === "Strong" ? "text-emerald-600" : op.status === "Good" ? "text-blue-600" : "text-amber-600"}`}>
                                  {op.score}%
                                </div>
                                <Badge className={`${op.status === "Strong" ? "bg-emerald-100 text-emerald-700" : op.status === "Good" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                  {op.status}
                                </Badge>
                              </div>
                            </div>

                            {/* Opportunity Type Badge */}
                            <div className="mb-3">
                              <Badge className="bg-linear-to-r from-indigo-100 to-purple-100 text-indigo-700 border-0 px-3 py-1.5">
                                <Target className="w-3.5 h-3.5 mr-1.5" />
                                {op.opportunityType}
                              </Badge>
                            </div>

                            {/* Primary Advantage */}
                            <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 mb-4">
                              <div className="flex items-center gap-2 text-sm">
                                <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                <span className="text-gray-700 font-medium">{op.primaryAdvantage}</span>
                              </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                              {/* Demand Pattern */}
                              <div className="p-2.5 rounded-lg bg-gray-50 border text-center">
                                <p className="text-xs text-gray-400 mb-1">Demand</p>
                                <p className="text-sm font-semibold text-gray-700">{op.demandPattern}</p>
                              </div>

                              {/* Operating Time */}
                              <div className="p-2.5 rounded-lg bg-gray-50 border text-center">
                                <p className="text-xs text-gray-400 mb-1">Best Time</p>
                                <div className="flex items-center justify-center gap-1">
                                  {op.operatingTime === "Day" ? <Sun className="w-3.5 h-3.5 text-amber-500" /> :
                                    op.operatingTime === "Evening" ? <Moon className="w-3.5 h-3.5 text-indigo-500" /> :
                                      <Clock className="w-3.5 h-3.5 text-blue-500" />}
                                  <span className="text-sm font-semibold text-gray-700">{op.operatingTime}</span>
                                </div>
                              </div>

                              {/* Setup Speed */}
                              <div className="p-2.5 rounded-lg bg-gray-50 border text-center">
                                <p className="text-xs text-gray-400 mb-1">Setup</p>
                                <div className="flex items-center justify-center gap-1">
                                  <Rocket className="w-3.5 h-3.5 text-emerald-500" />
                                  <span className="text-sm font-semibold text-gray-700">{op.setupSpeed}</span>
                                </div>
                              </div>

                              {/* Competition */}
                              <div className="p-2.5 rounded-lg bg-gray-50 border text-center">
                                <p className="text-xs text-gray-400 mb-1">Competition</p>
                                <span className={`text-sm font-semibold ${op.competitionLevel === "Low" ? "text-emerald-600" : op.competitionLevel === "Medium" ? "text-amber-600" : "text-rose-600"}`}>
                                  {op.competitionLevel}
                                </span>
                              </div>

                              {/* User Fit */}
                              <div className="p-2.5 rounded-lg bg-gray-50 border text-center">
                                <p className="text-xs text-gray-400 mb-1">User Fit</p>
                                <Badge className={`text-xs ${op.userFitLevel === "High" ? "bg-emerald-100 text-emerald-700" : op.userFitLevel === "Medium" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                                  {op.userFitLevel}
                                </Badge>
                              </div>
                            </div>

                            {/* View More Details Button */}
                            <button
                              onClick={() => toggleOpportunityDetails(`${category}-${index}`)}
                              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium mt-4 transition-colors"
                            >
                              <ChevronDown className={`w-4 h-4 transition-transform ${expandedOpportunities.has(`${category}-${index}`) ? "rotate-180" : ""}`} />
                              {expandedOpportunities.has(`${category}-${index}`) ? "Hide Details" : "View More Details"}
                            </button>

                            {/* Expanded Details Section */}
                            {expandedOpportunities.has(`${category}-${index}`) && (
                              <div className="mt-4 pt-4 border-t border-gray-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                {/* Why This Location */}
                                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                                  <h5 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-blue-600" />
                                    Why This Location
                                  </h5>
                                  <p className="text-sm text-gray-600">
                                    {op.competitionLevel === "Low"
                                      ? "This location has minimal direct competitors, giving you a first-mover advantage to capture market share quickly."
                                      : op.competitionLevel === "Medium"
                                        ? "Moderate competition exists here, but there's room to differentiate and attract customers with unique offerings."
                                        : "High competition area with established businesses. Success requires strong differentiation and competitive pricing."}
                                  </p>
                                </div>

                                {/* Time Feasibility */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="p-3 bg-gray-50 rounded-lg">
                                    <p className="text-xs text-gray-500 mb-1">Setup Timeline</p>
                                    <p className="font-semibold text-gray-800">
                                      {op.setupSpeed === "Fast" ? "2-4 weeks" : op.setupSpeed === "Moderate" ? "1-2 months" : "3-6 months"}
                                    </p>
                                  </div>
                                  <div className="p-3 bg-gray-50 rounded-lg">
                                    <p className="text-xs text-gray-500 mb-1">Expected Stability</p>
                                    <p className="font-semibold text-gray-800">
                                      {op.competitionLevel === "Low" ? "1-2 months" : op.competitionLevel === "Medium" ? "3-6 months" : "6-12 months"}
                                    </p>
                                  </div>
                                </div>

                                {/* Recommendation */}
                                <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl">
                                  <h5 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4 text-emerald-600" />
                                    Recommendation
                                  </h5>
                                  <p className="text-sm text-gray-600">
                                    {op.score >= 80
                                      ? "Excellent opportunity! This location has strong potential for your business type. Consider prioritizing this area for maximum ROI."
                                      : op.score >= 60
                                        ? "Good opportunity with moderate potential. Focus on differentiating your offering to stand out from nearby competitors."
                                        : "Proceed with caution. Ensure you have a clear competitive advantage before investing in this location."}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
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

              {/* Floating Compare Button */}
              {selectedForCompare.length >= 2 && (
                <div className="fixed bottom-8 right-8 z-30">
                  <Button
                    onClick={() => setShowCompareModal(true)}
                    className="h-14 px-6 bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-full shadow-xl shadow-indigo-200 transition-all hover:scale-105"
                  >
                    <Layers className="w-5 h-5 mr-2" />
                    Compare {selectedForCompare.length} Opportunities
                  </Button>
                  <Button
                    onClick={() => setSelectedForCompare([])}
                    variant="ghost"
                    className="ml-2 h-14 w-14 rounded-full bg-white shadow-lg hover:bg-gray-50"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </Button>
                </div>
              )}

              {/* Compare Modal */}
              {showCompareModal && selectedForCompare.length >= 2 && (
                <>
                  <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                    onClick={() => setShowCompareModal(false)}
                  />
                  <div className="fixed z-50 bg-white p-8 rounded-2xl shadow-2xl max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-linear-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-gray-800">Compare Opportunities</h2>
                          <p className="text-sm text-gray-500">Side-by-side comparison of selected opportunities</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => setShowCompareModal(false)}
                        className="h-10 w-10 rounded-full"
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>

                    {/* Comparison Grid */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="text-left p-3 bg-gray-50 rounded-tl-xl font-semibold text-gray-600 w-40">Attribute</th>
                            {selectedForCompare.map((op, idx) => (
                              <th key={idx} className={`p-3 bg-gray-50 text-center ${idx === selectedForCompare.length - 1 ? "rounded-tr-xl" : ""}`}>
                                <div className="flex flex-col items-center gap-2">
                                  <div className={`flex items-center justify-center w-8 h-8 rounded-lg text-white font-bold ${op.status === "Strong" ? "bg-emerald-500" : op.status === "Good" ? "bg-blue-500" : "bg-amber-500"}`}>
                                    {idx + 1}
                                  </div>
                                  <span className="font-semibold text-gray-800 text-sm">{op.name}</span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {/* Score */}
                          <tr className="border-t">
                            <td className="p-3 font-medium text-gray-600">Score</td>
                            {selectedForCompare.map((op, idx) => (
                              <td key={idx} className="p-3 text-center">
                                <span className={`text-2xl font-bold ${op.status === "Strong" ? "text-emerald-600" : op.status === "Good" ? "text-blue-600" : "text-amber-600"}`}>
                                  {op.score}%
                                </span>
                                <Badge className={`ml-2 ${op.status === "Strong" ? "bg-emerald-100 text-emerald-700" : op.status === "Good" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                                  {op.status}
                                </Badge>
                              </td>
                            ))}
                          </tr>
                          {/* Opportunity Type */}
                          <tr className="border-t bg-gray-50/50">
                            <td className="p-3 font-medium text-gray-600">Opportunity Type</td>
                            {selectedForCompare.map((op, idx) => (
                              <td key={idx} className="p-3 text-center">
                                <Badge className="bg-indigo-100 text-indigo-700 text-xs">
                                  {op.opportunityType}
                                </Badge>
                              </td>
                            ))}
                          </tr>
                          {/* Primary Advantage */}
                          <tr className="border-t">
                            <td className="p-3 font-medium text-gray-600">Primary Advantage</td>
                            {selectedForCompare.map((op, idx) => (
                              <td key={idx} className="p-3 text-center text-sm text-gray-700">
                                {op.primaryAdvantage}
                              </td>
                            ))}
                          </tr>
                          {/* Demand Pattern */}
                          <tr className="border-t bg-gray-50/50">
                            <td className="p-3 font-medium text-gray-600">Demand Pattern</td>
                            {selectedForCompare.map((op, idx) => (
                              <td key={idx} className="p-3 text-center">
                                <span className="text-sm font-medium text-gray-700">{op.demandPattern}</span>
                              </td>
                            ))}
                          </tr>
                          {/* Best Operating Time */}
                          <tr className="border-t">
                            <td className="p-3 font-medium text-gray-600">Best Time</td>
                            {selectedForCompare.map((op, idx) => (
                              <td key={idx} className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {op.operatingTime === "Day" ? <Sun className="w-4 h-4 text-amber-500" /> :
                                    op.operatingTime === "Evening" ? <Moon className="w-4 h-4 text-indigo-500" /> :
                                      <Clock className="w-4 h-4 text-blue-500" />}
                                  <span className="text-sm font-medium">{op.operatingTime}</span>
                                </div>
                              </td>
                            ))}
                          </tr>
                          {/* Setup Speed */}
                          <tr className="border-t bg-gray-50/50">
                            <td className="p-3 font-medium text-gray-600">Setup Speed</td>
                            {selectedForCompare.map((op, idx) => (
                              <td key={idx} className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Rocket className="w-4 h-4 text-emerald-500" />
                                  <span className="text-sm font-medium">{op.setupSpeed}</span>
                                </div>
                              </td>
                            ))}
                          </tr>
                          {/* Competition Level */}
                          <tr className="border-t">
                            <td className="p-3 font-medium text-gray-600">Competition</td>
                            {selectedForCompare.map((op, idx) => (
                              <td key={idx} className="p-3 text-center">
                                <Badge className={`text-xs ${op.competitionLevel === "Low" ? "bg-emerald-100 text-emerald-700" : op.competitionLevel === "Medium" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                                  {op.competitionLevel}
                                </Badge>
                              </td>
                            ))}
                          </tr>
                          {/* User Fit Level */}
                          <tr className="border-t bg-gray-50/50 rounded-b-xl">
                            <td className="p-3 font-medium text-gray-600 rounded-bl-xl">User Fit</td>
                            {selectedForCompare.map((op, idx) => (
                              <td key={idx} className={`p-3 text-center ${idx === selectedForCompare.length - 1 ? "rounded-br-xl" : ""}`}>
                                <Badge className={`text-xs ${op.userFitLevel === "High" ? "bg-emerald-100 text-emerald-700" : op.userFitLevel === "Medium" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                                  {op.userFitLevel}
                                </Badge>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Close Button */}
                    <Button
                      className="w-full mt-6 h-12 bg-linear-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white rounded-xl"
                      onClick={() => setShowCompareModal(false)}
                    >
                      Close Comparison
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </TabsContent>

        {/* ZONE ANALYSIS TAB */}
        <TabsContent value="zone-analysis" className="space-y-6">
          {/* Empty State - No Clustering */}
          {!hasClusteringResults ? (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <div className="p-4 bg-amber-100 rounded-full w-fit mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No zone analysis available yet</h3>
                <p className="text-gray-500">Run clustering to analyze zones.</p>
              </CardContent>
            </Card>
          ) : (
            <>
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
                                Evening operations may have lower customer flow
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
                                Morning hours may be slower for customer activity
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
            </>
          )}
        </TabsContent>

        {/* MARKET GAPS TAB */}
        <TabsContent value="market-gaps" className="space-y-6">
          {/* Empty State - No Clustering */}
          {!hasClusteringResults ? (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <div className="p-4 bg-amber-100 rounded-full w-fit mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No market gaps detected yet</h3>
                <p className="text-gray-500">Run clustering to identify opportunities.</p>
              </CardContent>
            </Card>
          ) : (
            <>
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-linear-to-br from-amber-500 to-orange-600 rounded-xl text-white shadow-lg shadow-amber-200">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Time-Based Gaps</CardTitle>
                        <p className="text-sm text-gray-500">
                          Coverage analysis for {timeBasedGapsData.location}
                        </p>
                      </div>
                    </div>
                    {!timeBasedGapsData.overallAssessment.gapsFound && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-0">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        All Periods Covered
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Morning Gap */}
                    <div className={`p-5 rounded-xl border-2 bg-white hover:shadow-md transition-all ${timeBasedGapsData.morning.status === "Gap Identified"
                      ? "border-rose-200"
                      : timeBasedGapsData.morning.status === "No Data Available"
                        ? "border-gray-200"
                        : "border-emerald-200"
                      }`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <Sun className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">Morning Hours ({timeBasedGapsData.morning.period})</h4>
                          <Badge className={`mt-1 ${timeBasedGapsData.morning.status === "Gap Identified"
                            ? "bg-rose-100 text-rose-700"
                            : timeBasedGapsData.morning.status === "No Data Available"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-emerald-100 text-emerald-700"
                            }`}>
                            {timeBasedGapsData.morning.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Business details */}
                      <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600">Active Businesses</span>
                          <span className="font-semibold text-gray-800">{timeBasedGapsData.morning.details.businessCount}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Main Types</span>
                          <span className="font-medium text-gray-700">
                            {timeBasedGapsData.morning.details.mainCategories.join(", ") || "—"}
                          </span>
                        </div>
                      </div>

                      {/* Insight */}
                      <p className="text-sm text-gray-700 mb-2">
                        {timeBasedGapsData.morning.insight}
                      </p>

                      {/* Reason */}
                      <p className="text-xs text-gray-500 italic">
                        {timeBasedGapsData.morning.reason}
                      </p>
                    </div>

                    {/* Evening Gap */}
                    <div className={`p-5 rounded-xl border-2 bg-white hover:shadow-md transition-all ${timeBasedGapsData.evening.status === "Gap Identified"
                      ? "border-rose-200"
                      : timeBasedGapsData.evening.status === "No Data Available"
                        ? "border-gray-200"
                        : "border-emerald-200"
                      }`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <Moon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">Evening Hours ({timeBasedGapsData.evening.period})</h4>
                          <Badge className={`mt-1 ${timeBasedGapsData.evening.status === "Gap Identified"
                            ? "bg-rose-100 text-rose-700"
                            : timeBasedGapsData.evening.status === "No Data Available"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-emerald-100 text-emerald-700"
                            }`}>
                            {timeBasedGapsData.evening.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Business details */}
                      <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600">Active Businesses</span>
                          <span className="font-semibold text-gray-800">{timeBasedGapsData.evening.details.businessCount}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Main Types</span>
                          <span className="font-medium text-gray-700">
                            {timeBasedGapsData.evening.details.mainCategories.join(", ") || "—"}
                          </span>
                        </div>
                      </div>

                      {/* Insight */}
                      <p className="text-sm text-gray-700 mb-2">
                        {timeBasedGapsData.evening.insight}
                      </p>

                      {/* Reason */}
                      <p className="text-xs text-gray-500 italic">
                        {timeBasedGapsData.evening.reason}
                      </p>
                    </div>
                  </div>

                  {/* Overall Assessment */}
                  <div className={`mt-4 p-4 rounded-xl border ${timeBasedGapsData.overallAssessment.gapsFound
                    ? "bg-amber-50 border-amber-200"
                    : "bg-emerald-50 border-emerald-200"
                    }`}>
                    <div className="flex items-start gap-3">
                      {timeBasedGapsData.overallAssessment.gapsFound ? (
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-800 mb-1">
                          {timeBasedGapsData.overallAssessment.summary}
                        </p>
                        <p className="text-xs text-gray-600">
                          {timeBasedGapsData.overallAssessment.recommendation}
                        </p>
                      </div>
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
            </>
          )}
        </TabsContent>

        {/* ARCHIVED: History tab content hidden for now
        <TabsContent value="history" className="space-y-6">
          {!hasClusteringResults ? (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
              <CardContent className="p-12 text-center">
                <div className="p-4 bg-amber-100 rounded-full w-fit mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No clustering history available</h3>
                <p className="text-gray-500">Run clustering to generate new results.</p>
              </CardContent>
            </Card>
          ) : (
            <ClusteringHistory
              onSelectHistory={(item) => {
                if (item.locations && item.locations.length > 0) {
                  toast.success(`Loaded: ${item.business_category}`, {
                    description: `${item.locations.length} opportunities from ${new Date(item.created_at).toLocaleDateString()}`,
                  });
                  setSelectedTab("overview");
                }
              }}
              maxItems={20}
            />
          )}
        </TabsContent>
        */}
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
