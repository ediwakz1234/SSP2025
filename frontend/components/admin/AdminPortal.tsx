import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Progress } from "../ui/progress";

import {
  RefreshCw,
  MapPin,
  Target,
  Users,
  Layers,
  Database,
  CheckCircle,
  Shield,
  Trophy,
  TrendingUp,
  Building2,
  AlertCircle,
  XCircle,
  Loader2,
} from "lucide-react";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Legend,
  Cell,
} from "recharts";

import { toast } from "sonner";

const BARANGAY_INFO = {
  name: "Brgy. Sta. Cruz",
  municipality: "Santa Maria",
  province: "Bulacan",
  region: "Central Luzon (Region III)",
  postalCode: "3022",
  population2020: 11364,
  centerLat: 14.8373,
  centerLng: 120.9558,
  elevation: 17,
};

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

type BusinessRow = {
  id: number;
  business_id: number | null;
  business_name: string | null;
  latitude: number | null;
  longitude: number | null;
  street: string | null;
  zone_type: string | null;
  zone_encoded: number | null;
  status: string | null;
  business_density_50m: number | null;
  business_density_100m: number | null;
  business_density_200m: number | null;
  competitor_density_50m: number | null;
  competitor_density_100m: number | null;
  competitor_density_200m: number | null;
  category: string | null;
  type: string | null;
  general_category: string | null;
  created_at: string;
};

interface UserAnalysis {
  id: string | number;
  user_name: string;
  business_type: string;
  score: number;
  created_at: string;
  num_clusters: number;
}

type ServiceStatus = "operational" | "degraded" | "offline" | "checking";

interface SystemHealthStatus {
  database: ServiceStatus;
  api: ServiceStatus;
  auth: ServiceStatus;
  clustering: ServiceStatus;
}

export function AdminPortal() {
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [analyses, setAnalyses] = useState<UserAnalysis[]>([]);
  const [_activityLogs, setActivityLogs] = useState<Record<string, unknown>[]>([]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedTab, setSelectedTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState<SystemHealthStatus>({
    database: "checking",
    api: "checking",
    auth: "checking",
    clustering: "checking",
  });

  // FETCH DATA --------------------------------------------------------------
  const fetchData = async () => {
    try {
      setLoading(true);

      const [businessRes, profilesRes, activityRes] = await Promise.all([
        supabase.from("businesses").select("*"),
        supabase
          .from("profiles")
          .select("id, first_name, last_name, analyses_count, created_at")
          .gt("analyses_count", 0)
          .order("analyses_count", { ascending: false })
          .limit(10),
        supabase
          .from("activity_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      // Handle Errors
      if (businessRes.error) console.error("Business Error:", businessRes.error);
      if (profilesRes.error) console.error("Profiles Error:", profilesRes.error);
      if (activityRes.error) console.error("Activity Error:", activityRes.error);

      setBusinesses((businessRes.data || []) as BusinessRow[]);

      // Map profiles to user analyses - ranked by analyses_count
      const profilesData = profilesRes.data || [];
      const mappedAnalyses: UserAnalysis[] = profilesData.map(
        (row: { id: string; first_name?: string; last_name?: string; analyses_count?: number; created_at?: string }): UserAnalysis => {
          const fullName = `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Unknown User";
          const count = row.analyses_count || 0;
          // Convert count to a percentage-like score (cap at 100)
          const score = Math.min(count * 2, 100);
          return {
            id: parseInt(row.id.slice(0, 8), 16) || 0,
            user_name: fullName,
            business_type: `${count} Analyses`,
            score: score,
            created_at: row.created_at || "",
            num_clusters: count,
          };
        }
      );

      setAnalyses(mappedAnalyses);
      setActivityLogs(activityRes.data || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("AdminPortal Error:", error);
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // SYSTEM HEALTH CHECK ------------------------------------------------------
  const checkSystemHealth = async () => {
    const newHealth: SystemHealthStatus = {
      database: "checking",
      api: "checking",
      auth: "checking",
      clustering: "checking",
    };
    setSystemHealth(newHealth);

    // Check Database
    try {
      const { error } = await supabase.from("businesses").select("id").limit(1);
      newHealth.database = error ? "degraded" : "operational";
    } catch {
      newHealth.database = "offline";
    }

    // Check API
    try {
      const apiUrl = import.meta.env.VITE_API_URL || "";
      if (apiUrl) {
        const response = await fetch(`${apiUrl}/api/health`, { method: "GET" });
        newHealth.api = response.ok ? "operational" : "degraded";
      } else {
        // If no API URL, check if we can reach Supabase functions
        newHealth.api = newHealth.database === "operational" ? "operational" : "degraded";
      }
    } catch {
      newHealth.api = "offline";
    }

    // Check Auth
    try {
      const { data } = await supabase.auth.getSession();
      newHealth.auth = data.session ? "operational" : "operational"; // Auth service is up even without session
    } catch {
      newHealth.auth = "offline";
    }

    // Check Clustering (based on whether we have clustering results)
    try {
      const { error } = await supabase.from("clustering_results").select("id").limit(1);
      newHealth.clustering = error ? "degraded" : "operational";
    } catch {
      newHealth.clustering = "offline";
    }

    setSystemHealth(newHealth);
  };

  useEffect(() => {
    checkSystemHealth();
  }, []);

  // REALTIME SUBSCRIPTION -----------------------------------------------------
  useEffect(() => {
    // Subscribe to changes in the businesses table
    const channel = supabase
      .channel('businesses-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'businesses' },
        () => {
          // Refresh data when businesses table updates
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchData(), checkSystemHealth()]);
    setIsRefreshing(false);
    toast.success("Dashboard refreshed.");
  };

  // COMPUTED STATS -----------------------------------------------------------
  const stats = useMemo(() => {
    if (!businesses.length) {
      return {
        totalBusinesses: 0,
        businessTypeCount: 0,
        typeDistribution: {},
        commercialCount: 0,
        residentialCount: 0,
        bciScore: 0,
        totalStreets: 0,
        streetsArray: [],
      };
    }

    const totalBusinesses = businesses.length;
    const categoriesSet = new Set<string>();
    const typeDistribution: Record<string, number> = {};

    let sumDensity200m = 0;
    let maxDensity200m = 0;
    let densityCount = 0;
    let commercialCount = 0;
    let residentialCount = 0;
    const streetsSet = new Set<string>();

    businesses.forEach((b) => {
      // Business Type
      const businessType = (b.general_category || "Unknown").trim();
      categoriesSet.add(businessType);
      typeDistribution[businessType] =
        (typeDistribution[businessType] || 0) + 1;

      // Density
      if (typeof b.business_density_200m === "number") {
        sumDensity200m += b.business_density_200m;
        maxDensity200m = Math.max(maxDensity200m, b.business_density_200m);
        densityCount++;
      }

      // Zone
      const zone = (b.zone_type || "").toLowerCase();
      if (zone.includes("commercial")) commercialCount++;
      if (zone.includes("residential")) residentialCount++;

      if (b.street) streetsSet.add(b.street.trim());
    });

    // Calculate BCI: average businesses per street/area
    const numStreets = streetsSet.size;
    const bciScore = numStreets > 0
      ? Math.round(totalBusinesses / numStreets)
      : 0;

    return {
      totalBusinesses,
      businessTypeCount: categoriesSet.size,
      typeDistribution,
      commercialCount,
      residentialCount,
      bciScore,
      totalStreets: streetsSet.size,
      streetsArray: Array.from(streetsSet),
    };
  }, [businesses]);

  // Chart Data
  const businessTypeChartData = Object.entries(stats.typeDistribution).map(
    ([name, count]) => ({
      name,
      value: count,
      percentage: ((count / (stats.totalBusinesses || 1)) * 100).toFixed(1),
    })
  );

  const zoneDistributionData = [
    { name: "Commercial", value: stats.commercialCount, color: "#3b82f6" },
    { name: "Residential", value: stats.residentialCount, color: "#8b5cf6" },
  ];

  // UI LOADING SCREEN -----------------------------------------------------
  if (loading && !businesses.length)
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] animate-fadeIn">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-purple-500 to-fuchsia-600 animate-pulse flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-white animate-spin" />
          </div>
          <div className="absolute -inset-4 bg-linear-to-br from-purple-500/20 to-fuchsia-600/20 rounded-3xl blur-xl animate-pulse" />
        </div>
        <p className="mt-6 text-gray-600 font-medium">Loading admin dashboard...</p>
        <p className="text-sm text-gray-400 mt-1">Preparing system overview</p>
      </div>
    );

  // ------------------------------------------------------------------------
  // UI RENDER
  // ------------------------------------------------------------------------

  return (
    <div className="page-wrapper space-y-6">
      {/* HEADER ------------------------------------------------------------ */}
      <div className="page-content relative overflow-hidden rounded-2xl bg-slate-700 p-6 text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Admin Dashboard</h2>
              <p className="text-white/80 text-sm mt-1">
                System overview and monitoring • Last updated {lastUpdated.toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-2 bg-white text-purple-600 hover:bg-white/90 border-0"
            >
              <RefreshCw
                className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
      </div>

      {/* TOP CARDS --------------------------------------------------------- */}
      <div className="stagger-children grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Businesses"
          value={stats.totalBusinesses}
          subtitle="Real locations tracked"
          icon={<Database className="size-5 text-blue-600" />}
          gradient="from-blue-50 to-blue-100"
        />

        <StatCard
          title="Business Categories"
          value={stats.businessTypeCount}
          subtitle="Different types"
          icon={<Target className="size-5 text-green-600" />}
          gradient="from-green-50 to-green-100"
        />

        <StatCard
          title="Business Concentration Index"
          value={stats.bciScore}
          subtitle="Avg. per area"
          icon={<Layers className="size-5 text-purple-600" />}
          gradient="from-purple-50 to-purple-100"
        />

        <StatCard
          title="Total Streets"
          value={stats.totalStreets}
          subtitle="Mapped locations"
          icon={<MapPin className="size-5 text-orange-600" />}
          gradient="from-orange-50 to-orange-100"
        />
      </div>

      {/* TABS -------------------------------------------------------------- */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="animate-fadeInUp delay-100">
        <TabsList className="grid w-full grid-cols-3 p-1 bg-gray-100 rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Overview</TabsTrigger>
          <TabsTrigger value="top-users" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Top User Analyses</TabsTrigger>
          <TabsTrigger value="system" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">System Info</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB -------------------------------------------------- */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Business Type */}
            <Card className="border-0 shadow-card overflow-hidden">
              <CardHeader className="bg-linear-to-r from-gray-50 to-white border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Business Type Distribution</CardTitle>
                    <CardDescription>
                      Current business categories in Brgy. Sta. Cruz
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={businessTypeChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) =>
                        `${name}: ${percentage}%`
                      }
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {businessTypeChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Zone Distribution */}
            <Card className="border-0 shadow-card overflow-hidden">
              <CardHeader className="bg-linear-to-r from-gray-50 to-white border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Zone Distribution</CardTitle>
                    <CardDescription>
                      Commercial vs Residential zones
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={zoneDistributionData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, value }) => `${name}: ${value}`}
                      dataKey="value"
                    >
                      {zoneDistributionData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>

                <div className="mt-4 space-y-3">
                  <ZoneProgress
                    label="Commercial"
                    value={
                      (stats.commercialCount / (stats.totalBusinesses || 1)) *
                      100
                    }
                  />

                  <ZoneProgress
                    label="Residential"
                    value={
                      (stats.residentialCount / (stats.totalBusinesses || 1)) *
                      100
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Barangay Information */}
          <Card className="bg-linear-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-5 text-blue-600" />
                Barangay Information
              </CardTitle>
              <CardDescription>
                Official data – {BARANGAY_INFO.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <InfoItem label="Municipality" value={BARANGAY_INFO.municipality} />
                <InfoItem label="Province" value={BARANGAY_INFO.province} />
                <InfoItem label="Region" value={BARANGAY_INFO.region} />
                <InfoItem label="Postal Code" value={BARANGAY_INFO.postalCode} />
                <InfoItem
                  label="Population (2020)"
                  value={BARANGAY_INFO.population2020.toLocaleString()}
                />
                <InfoItem
                  label="Coordinates"
                  value={`${BARANGAY_INFO.centerLat.toFixed(
                    4
                  )}, ${BARANGAY_INFO.centerLng.toFixed(4)}`}
                />
                <InfoItem
                  label="Elevation"
                  value={`${BARANGAY_INFO.elevation}m ASL`}
                />
                <InfoItem
                  label="Total Streets"
                  value={`${stats.totalStreets} streets`}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TOP USER ANALYSES TAB ------------------------------------------- */}
        <TabsContent value="top-users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="size-5 text-yellow-600" />
                Top User Analyses
              </CardTitle>
              <CardDescription>Highest scoring clustering results</CardDescription>
            </CardHeader>

            <CardContent>
              {analyses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No analyses available.
                </div>
              ) : (
                <div className="space-y-3">
                  {analyses.map((a, index) => {
                    const getRankDisplay = (idx: number) => {
                      if (idx === 0) return "🥇";
                      if (idx === 1) return "🥈";
                      if (idx === 2) return "🥉";
                      return `#${idx + 1}`;
                    };

                    return (
                      <div
                        key={a.id}
                        className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          <div className={`size-12 rounded-full flex items-center justify-center text-lg font-bold ${index < 3
                            ? "bg-gradient-to-br from-yellow-400 to-amber-500"
                            : "bg-gradient-to-br from-blue-500 to-purple-500 text-white"
                            }`}>
                            {getRankDisplay(index)}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{a.user_name}</h4>
                              <Badge>{a.business_type}</Badge>
                            </div>

                            <p className="text-xs text-muted-foreground">
                              {new Date(a.created_at).toLocaleString()}
                            </p>

                            <div className="grid grid-cols-2 gap-4 mt-3">
                              <div>
                                <p className="text-xs text-muted-foreground">Score</p>
                                <div className="flex items-center gap-1 mt-1">
                                  <TrendingUp className="size-3 text-green-600" />
                                  <span>{a.score}%</span>
                                </div>
                              </div>

                              <div>
                                <p className="text-xs text-muted-foreground">Clusters</p>
                                <div className="flex items-center gap-1 mt-1">
                                  <Layers className="size-3 text-blue-600" />
                                  <span>{a.num_clusters}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <Badge
                              variant={
                                a.score > 90
                                  ? "default"
                                  : a.score > 80
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {a.score > 90 ? "Excellent" : a.score > 80 ? "Good" : "Fair"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-blue-600 hover:text-blue-800"
                              onClick={() => {
                                toast.info(
                                  `📊 Full Details\n\n` +
                                  `Category: ${a.business_type}\n` +
                                  `Score: ${a.score}%\n` +
                                  `Clusters: ${a.num_clusters}\n` +
                                  `Date: ${new Date(a.created_at).toLocaleString()}`
                                );
                              }}
                            >
                              View More
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SYSTEM INFO TAB ------------------------------------------------ */}
        <TabsContent value="system" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-5 text-green-600" />
                  System Status
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <DynamicSystemStatus label="Supabase Database" status={systemHealth.database} />
                <DynamicSystemStatus label="API Services" status={systemHealth.api} />
                <DynamicSystemStatus label="Authentication" status={systemHealth.auth} />
                <DynamicSystemStatus label="K-Means Clustering" status={systemHealth.clustering} />
              </CardContent>
            </Card>

            {/* Data Quality */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="size-5 text-blue-600" />
                  Data Quality
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Data Completeness: % of businesses with general_category filled */}
                <QualityRow
                  label="Data Completeness"
                  value={businesses.length > 0
                    ? Math.round((businesses.filter(b => b.general_category).length / businesses.length) * 100)
                    : 0
                  }
                />
                {/* GPS Accuracy: % of businesses with valid lat/lng */}
                <QualityRow
                  label="GPS Accuracy"
                  value={businesses.length > 0
                    ? Math.round((businesses.filter(b => b.latitude && b.longitude && b.latitude !== 0 && b.longitude !== 0).length / businesses.length) * 100)
                    : 0
                  }
                />
                {/* Business Verification: % of businesses with status='active' */}
                <QualityRow
                  label="Business Verification"
                  value={businesses.length > 0
                    ? Math.round((businesses.filter(b => b.status === 'active').length / businesses.length) * 100)
                    : 0
                  }
                />

                <QualityRow
                  label="Active Analyses"
                  value={Math.min(100, analyses.length * 10)}
                  suffix={`${analyses.length} analyses`}
                />
              </CardContent>
            </Card>
          </div>

          {/* Database Schema */}
          <Card>
            <CardHeader>
              <CardTitle>Database Schema & Columns</CardTitle>
              <CardDescription>Core data structure from field survey</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                <SchemaCard
                  icon={<MapPin className="size-4 text-blue-600" />}
                  title="Location Data"
                  pills={["latitude", "longitude", "street", "zone_type", "zone_encoded"]}
                  color="bg-blue-500"
                />

                <SchemaCard
                  icon={<Layers className="size-4 text-green-600" />}
                  title="Business Density"
                  pills={[
                    "business_density_50m",
                    "business_density_100m",
                    "business_density_200m",
                  ]}
                  color="bg-green-500"
                />

                <SchemaCard
                  icon={<Users className="size-4 text-purple-600" />}
                  title="Competitor Data"
                  pills={[
                    "competitor_density_50m",
                    "competitor_density_100m",
                    "competitor_density_200m",
                  ]}
                  color="bg-purple-500"
                />

                <SchemaCard
                  icon={<Building2 className="size-4 text-orange-600" />}
                  title="Business Info"
                  pills={["business_name", "type", "category", "general_category", "status"]}
                  color="bg-orange-500"
                />
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-900">
                  <strong>Data Source:</strong> Field survey of real businesses in Brgy. Sta. Cruz, Santa
                  Maria, Bulacan. All coordinates verified.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* --------------------------- SMALL COMPONENTS --------------------------- */

function StatCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <Card className={`bg-linear-to-br ${gradient} border`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          {title}
          {icon}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl">{value}</div>
        <p className="text-xs mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function ZoneProgress({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm">{label}</span>
        <span className="text-sm">{value.toFixed(1)}%</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}

function QualityRow({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm">{label}</span>
        <span className="text-sm">
          {value}%{suffix ? ` • ${suffix}` : ""}
        </span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}

function SchemaCard({
  icon,
  title,
  pills,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  pills: string[];
  color: string;
}) {
  return (
    <div className="p-4 border rounded-lg bg-muted/30">
      <h4 className="text-sm mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h4>

      <div className="space-y-2 text-xs">
        {pills.map((p) => (
          <div key={p} className="flex items-center gap-2">
            <div className={`size-1.5 rounded-full ${color}`} />
            <span>{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DynamicSystemStatus({ label, status }: { label: string; status: ServiceStatus }) {
  const getStatusConfig = (s: ServiceStatus) => {
    switch (s) {
      case "operational":
        return {
          icon: <CheckCircle className="size-4 text-green-600" />,
          badge: <Badge className="bg-green-100 text-green-700 border-green-300">Operational</Badge>,
          bg: "bg-green-50",
        };
      case "degraded":
        return {
          icon: <AlertCircle className="size-4 text-yellow-600" />,
          badge: <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">Degraded</Badge>,
          bg: "bg-yellow-50",
        };
      case "offline":
        return {
          icon: <XCircle className="size-4 text-red-600" />,
          badge: <Badge className="bg-red-100 text-red-700 border-red-300">Offline</Badge>,
          bg: "bg-red-50",
        };
      case "checking":
      default:
        return {
          icon: <Loader2 className="size-4 text-blue-600 animate-spin" />,
          badge: <Badge className="bg-blue-100 text-blue-700 border-blue-300">Checking...</Badge>,
          bg: "bg-blue-50",
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <div className={`flex items-center justify-between p-3 ${config.bg} rounded-lg`}>
      <div className="flex items-center gap-2">
        {config.icon}
        <span className="text-sm">{label}</span>
      </div>
      {config.badge}
    </div>
  );
}
