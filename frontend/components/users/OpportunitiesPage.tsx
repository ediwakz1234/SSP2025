import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import {toast} from "sonner";
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
} from "lucide-react";

import Papa from "papaparse";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  cluster: number;
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
  const [clusteringResults, setClusteringResults] =
    useState<ClusteringRow | null>(null);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("overview");
  const [showAll, setShowAll] = useState(false);
  const [openExportModal, setOpenExportModal] = useState(false);
  const [_showExportModal, setShowExportModal] = useState(false);


  // Load latest clustering result and active businesses
  useEffect(() => {
    const loadData = async () => {
      const [clusterRes, bizRes] = await Promise.all([
        supabase
          .from("clustering_opportunities")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from("businesses") // adjust table name if needed
          .select("*")
          .eq("status", "Active"),
      ]);

      if (!clusterRes.error && clusterRes.data) {
        setClusteringResults(clusterRes.data as ClusteringRow);
      }

      if (!bizRes.error && bizRes.data) {
        setBusinesses(bizRes.data as BusinessRow[]);
      }

      setLoading(false);
    };

    loadData();
  }, []);

// ----------------------------------------
// LOADING SCREEN
// ----------------------------------------
if (loading) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto animate-pulse">
            <Lightbulb className="w-8 h-8 text-white" />
          </div>
          <div className="absolute inset-0 w-16 h-16 mx-auto rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin" />
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">Loading Opportunities</p>
          <p className="text-sm text-gray-500">Analyzing business data for insights...</p>
        </div>
      </div>
    </div>
  );
}


  if (!clusteringResults || !clusteringResults.locations) {
    return (
      <div className="page-wrapper">
        <Card className="p-12 text-center border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-linear-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <Lightbulb className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-700">No Opportunities Yet</h3>
              <p className="text-gray-500 mt-1">Run clustering analysis first to discover business opportunities</p>
            </div>
            <Button 
              onClick={() => navigate("/user/dashboard/clustering")}
              className="mt-4 bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
            >
              Go to Clustering
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const businessType = clusteringResults.business_category;
  const numClusters = clusteringResults.num_clusters ?? 0;

  // Build opportunities array
  const opportunities: Opportunity[] = clusteringResults.locations.map(
    (loc: LocationData): Opportunity => {
      const businessDensity: number = loc.business_density_200m;
      const competitors: number = loc.competitor_density_200m;

      return {
        title: `${businessType} near ${loc.street}`,
        category: loc.general_category,
        location: loc.street,
        businessDensity,
        competitors,
        zone_type: loc.zone_type,
        saturation: computeSaturation(businessDensity, competitors),
        score: computeOpportunityScore(
          businessDensity,
          competitors,
          loc.zone_type
        ),
        cluster: loc.cluster,
        coordinates: {
          lat: loc.latitude,
          lng: loc.longitude,
        },
        insights: generateInsights({
          businessDensity,
          competitors,
          zone_type: loc.zone_type,
        }),
      };
    }
  );

  const displayedOps = showAll ? opportunities : opportunities.slice(0, 5);
  const kpis = calculateKPIs(opportunities);

  // Overview + Market Gap derived data
  const categoryStats = buildCategoryStats(businesses);
  const zoneStats = buildZoneStats(businesses);
  const totalBusinesses = businesses.length;

  const marketGaps = buildMarketGaps(businesses, opportunities);

  const topCategory = categoryStats[0];
  const lowestCompetition = [...categoryStats].sort(
    (a, b) => a.avgCompetitors - b.avgCompetitors
  )[0];

  // ---------------------------------------------------------------------------
  // EXPORT FUNCTIONS (Opportunities list only)
  // ---------------------------------------------------------------------------

  const exportCSV = () => {
    const rows = opportunities.map((o: Opportunity) => ({
      Title: o.title,
      Category: o.category,
      Cluster: o.cluster,
      BusinessDensity: o.businessDensity,
      Competitors: o.competitors,
      ZoneType: o.zone_type,
      Saturation: `${o.saturation}%`,
      Score: `${o.score}%`,
      Latitude: o.coordinates.lat,
      Longitude: o.coordinates.lng,
      Insights: o.insights.join(" | "),
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "opportunities.csv";
    a.click();
    
  toast.success("Exported report as CSV");
  logActivity("Exported Opportunities Report", { format: "CSV" });
  };

  const exportExcel = () => {
    const rows = opportunities.map((o: Opportunity) => ({
      Title: o.title,
      Category: o.category,
      Cluster: o.cluster,
      BusinessDensity: o.businessDensity,
      Competitors: o.competitors,
      ZoneType: o.zone_type,
      Saturation: `${o.saturation}%`,
      Score: `${o.score}%`,
      Latitude: o.coordinates.lat,
      Longitude: o.coordinates.lng,
      Insights: o.insights.join(" | "),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Opportunities");
    XLSX.writeFile(workbook, "opportunities.xlsx");
     toast.success("Exported report as Excel");
  logActivity("Exported Opportunities Report", { format: "Excel" });
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Business Opportunities Report", 14, 10);

    const rows = opportunities.map((o: Opportunity) => [
      o.title,
      o.category,
      o.cluster,
      o.businessDensity,
      o.competitors,
      o.zone_type,
      `${o.saturation}%`,
      `${o.score}%`,
      o.coordinates.lat,
      o.coordinates.lng,
    ]);

    autoTable(doc, {
      head: [
        [
          "Title",
          "Category",
          "Cluster",
          "Density",
          "Competitors",
          "Zone",
          "Saturation",
          "Score",
          "Lat",
          "Lng",
        ],
      ],
      body: rows,
      startY: 20,
      styles: { fontSize: 8 },
    });

    doc.save("opportunities.pdf");
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
              <span className="text-sm font-medium">{kpis.totalOpportunities} Opportunities</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium">{totalBusinesses} Active Businesses</span>
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
            <div className="text-4xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{kpis.totalOpportunities}</div>
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
            <div className="text-4xl font-bold bg-linear-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">{kpis.avgBusinessDensity}</div>
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
            <div className="text-4xl font-bold bg-linear-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">{kpis.avgCompetition}</div>
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
              {zoneStats.find((z) => z.zone === "Commercial")?.count ?? 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">of {totalBusinesses} total</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full h-14 bg-white/80 backdrop-blur-sm shadow-lg rounded-xl p-1.5">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg font-medium transition-all">
            Overview
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="rounded-lg data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg font-medium transition-all">
            Opportunities
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
                            className={`border-0 text-white shadow-md ${
                              gap.gapLevel === "High"
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
    </div>
  );
}
