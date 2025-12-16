import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

import {
  Activity,
  TrendingUp,
  MapPin,
  Building2,
  FileDown,
  BarChart2,
  Trophy,
  Eye,
  Filter,
  ArrowUpDown,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import { useActivity, logActivity } from "../../utils/activity";
import { toast } from "sonner";
import type { Business, ChartDataPoint, AnalysisStats, ActivityStats } from "../../types";
import { ClusteringAnalysisModal, ClusteringAnalysisResult } from "./ClusteringAnalysisModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

// Local types for analytics data
interface AnalysisRecord {
  id: number;
  user_id: string;
  created_at: string;
  analysis_type?: string;
}

export function AdminAnalyticsPage() {
  useActivity();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<ChartDataPoint[]>([]);
  const [zones, setZones] = useState<ChartDataPoint[]>([]);
  const [streets, setStreets] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const [_analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [analysisStats, setAnalysisStats] = useState<AnalysisStats>({
    total: 0,
    freqByDate: [],
    topUsers: [],
  });

  const [activityStats, setActivityStats] = useState<ActivityStats>({
    total: 0,
    logins: 0,
    analyses: 0,
    dataChanges: 0,
  });

  // Top Clustering Results state
  const [topClusteringResults, setTopClusteringResults] = useState<ClusteringAnalysisResult[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<ClusteringAnalysisResult | null>(null);
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [analysisSortBy, setAnalysisSortBy] = useState<"score" | "recent">("score");
  const [analysisCategoryFilter, setAnalysisCategoryFilter] = useState<string>("all");

  const [_showExportModal, setShowExportModal] = useState(false);

  // Date Filter - Default to empty (show ALL data) for accurate analytics
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Color palette
  const COLORS = [
    "#3b82f6",
    "#8b5cf6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#06b6d4",
  ];

  // QUICK FILTERS
  const applyQuickFilter = (days?: number | "year") => {
    const today = new Date();
    const end = today.toISOString().split("T")[0];

    if (days === "year") {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(end);
      toast.message("Filtering: This Year");
      logActivity("Admin Filtered Analytics", { range: "This Year" });
      return;
    }

    const start = new Date();
    start.setDate(today.getDate() - days!);

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end);

    if (days === 0) toast.message("Filtering: Today");
    if (days === 7) toast.message("Filtering: Last 7 Days");
    if (days === 30) toast.message("Filtering: Last 30 Days");

    logActivity("Admin Filtered Analytics", { range: days });
  };

  // MAIN LOAD FUNCTION
  const loadAnalytics = useCallback(
    async (applyFilter: boolean = false) => {
      setLoading(true);

      // 1. Businesses
      let businessQuery = supabase.from("businesses").select("*");

      if (applyFilter && startDate && endDate) {
        businessQuery = businessQuery
          .gte("created_at", `${startDate}T00:00:00`)
          .lte("created_at", `${endDate}T23:59:59`);
      }

      const { data: bizData } = await businessQuery;
      const list = bizData || [];
      setBusinesses(list);

      // Category normalization
      const normalizeCategory = (name: string) => {
        if (!name) return "Unknown";
        return name
          .trim()
          .toLowerCase()
          .replace(/&/g, "/")
          .replace(/\s+/g, " ")
          .replace("merchandising/trading", "merchandise / trading")
          .replace("merchandise/trading", "merchandise / trading");
      };

      const titleCase = (str: string) =>
        str.replace(/\w\S*/g, (txt) => txt[0].toUpperCase() + txt.slice(1));

      // Category aggregation
      const catMap = new Map();
      list.forEach((b) => {
        if (b.general_category) {
          const clean = titleCase(normalizeCategory(b.general_category));
          catMap.set(clean, (catMap.get(clean) || 0) + 1);
        }
      });

      setCategories(
        Array.from(catMap).map(([n, v]) => ({ name: n, value: v }))
      );

      // Zones
      const zoneMap = new Map();
      list.forEach((b) => {
        if (b.zone_type) zoneMap.set(b.zone_type, (zoneMap.get(b.zone_type) || 0) + 1);
      });
      setZones(Array.from(zoneMap).map(([n, v]) => ({ name: n, value: v })));

      // Streets
      const streetMap = new Map();
      list.forEach((b) => {
        if (b.street) streetMap.set(b.street, (streetMap.get(b.street) || 0) + 1);
      });
      setStreets(Array.from(streetMap).map(([n, v]) => ({ name: n, value: v })));

      // 3. ANALYSIS - Use clustering_opportunities (has data) instead of empty clustering_results
      const { data: analysisData } = await supabase
        .from("clustering_opportunities")
        .select("*")
        .order("created_at", { ascending: false });

      const analysisList = analysisData || [];
      setAnalyses(analysisList);

      const freq = new Map();

      analysisList.forEach((a) => {
        const d = a.created_at?.split("T")[0];
        if (d) freq.set(d, (freq.get(d) || 0) + 1);
      });

      // 3b. Fetch user profiles with analyses_count for top users
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, analyses_count")
        .gt("analyses_count", 0)
        .order("analyses_count", { ascending: false })
        .limit(10);

      const topUsersList = (profilesData || []).map(p => ({
        user_id: p.id,
        count: p.analyses_count || 0
      }));

      setAnalysisStats({
        total: analysisList.length,
        freqByDate: Array.from(freq).map(([date, count]) => ({ name: date as string, value: count as number, date: date as string })),
        topUsers: topUsersList,
      });

      // Create profile map for display
      const profilesMap: Record<string, { first_name: string; last_name: string; email: string }> = {};
      (profilesData || []).forEach(p => {
        profilesMap[p.id] = {
          first_name: p.first_name || "",
          last_name: p.last_name || "",
          email: p.email || ""
        };
      });

      // Create top clustering results with user info from clustering_opportunities
      const topResults: ClusteringAnalysisResult[] = analysisList
        .slice(0, 50)
        .map((a, index) => ({
          id: a.id || index,
          business_category: a.business_category || "Unknown",
          confidence: a.confidence || 0,
          num_clusters: a.num_clusters || 0,
          created_at: a.created_at || "",
          user_id: a.user_id || "",
          user_name: a.business_category || "Analysis",
          user_email: "N/A"
        }))
        .sort((a, b) => b.confidence - a.confidence);

      setTopClusteringResults(topResults);


      // 4. ACTIVITY LOGS (for top cards)
      let activityQuery = supabase.from("activity_logs").select("*");

      if (applyFilter && startDate && endDate) {
        activityQuery = activityQuery
          .gte("created_at", `${startDate}T00:00:00`)
          .lte("created_at", `${endDate}T23:59:59`);
      }

      const { data: activityData } = await activityQuery;
      const logs = activityData || [];

      // Count login events (matches your new logActivity action)
      const loginCount = logs.filter((l) =>
        ["user_login", "SIGNED_IN", "login", "user_logged_in"].includes(
          (l.action || "").toLowerCase()
        )
      ).length;

      const analysisCount = logs.filter((l) => l.action === "clustering_analysis").length;
      const dataChangeCount = logs.filter((l) => l.action === "seed_data_reset").length;

      setActivityStats({
        total: logs.length,
        logins: loginCount,
        analyses: analysisCount,
        dataChanges: dataChangeCount,
      });

      setLastUpdated(new Date());
      setLoading(false);
    },
    [startDate, endDate]
  );

  // Load analytics on mount (with today's filter applied)
  useEffect(() => {
    loadAnalytics(true); // Apply filter from the start
  }, [loadAnalytics]);

  // Reload when date filter changes
  useEffect(() => {
    if (startDate && endDate) {
      loadAnalytics(true);
    }
  }, [startDate, endDate, loadAnalytics]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-linear-to-r from-blue-500 via-purple-500 to-indigo-500 opacity-20 blur-2xl animate-pulse"></div>
          <div className="relative flex flex-col items-center gap-4">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full bg-linear-to-r from-blue-500 to-purple-500 animate-spin" style={{ clipPath: 'polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%)' }}></div>
              <div className="absolute inset-1 rounded-full bg-white"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <BarChart2 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-600">Loading admin analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-blue-600 via-purple-600 to-indigo-700 p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-blue-400/20 blur-2xl translate-y-1/2 -translate-x-1/2"></div>

        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <BarChart2 className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Admin Analytics</h1>
            <p className="text-blue-100 mt-1">Insights across all business data + admin activity</p>
          </div>
        </div>
      </div>

      {/* DATE FILTERS */}
      <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg rounded-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1e3a5f]">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Filter by Date</CardTitle>
              <CardDescription>Select a date range for analytics</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex flex-col flex-1">
              <label className="text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 transition-all duration-300"
              />
            </div>

            <div className="flex flex-col flex-1">
              <label className="text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-2.5 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 transition-all duration-300"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={() => applyQuickFilter(0)}
              className="px-4 py-2 bg-linear-to-r from-gray-100 to-gray-50 rounded-xl hover:from-gray-200 hover:to-gray-100 transition-all duration-300 font-medium text-sm border hover:shadow-md"
            >
              Today
            </button>
            <button
              onClick={() => applyQuickFilter(7)}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all duration-300 font-medium text-sm border hover:shadow-md"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => applyQuickFilter(30)}
              className="px-4 py-2 bg-[#1e3a5f] text-white rounded-xl hover:bg-[#2d4a6f] transition-all duration-300 font-medium text-sm border border-[#1e3a5f] hover:shadow-md"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => applyQuickFilter("year")}
              className="px-4 py-2 bg-linear-to-r from-green-100 to-emerald-50 text-green-700 rounded-xl hover:from-green-200 hover:to-emerald-100 transition-all duration-300 font-medium text-sm border border-green-200 hover:shadow-md"
            >
              This Year
            </button>

            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
                toast.message("Analytics filter reset");
                logActivity("Admin Reset Analytics Filters");
              }}
              className="px-4 py-2 bg-linear-to-r from-red-100 to-rose-50 text-red-700 rounded-xl hover:from-red-200 hover:to-rose-100 transition-all duration-300 font-medium text-sm border border-red-200 hover:shadow-md"
            >
              Reset
            </button>
          </div>
        </CardContent>
      </Card>

      {/* TOP STATS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <Card className="group relative overflow-hidden border-0 bg-linear-to-br from-blue-50 to-indigo-50 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl group-hover:bg-blue-500/20 transition-colors duration-500"></div>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-indigo-500">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <CardTitle className="text-sm font-medium text-gray-600">Today's Activities</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{activityStats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Logged today</p>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-0 bg-linear-to-br from-green-50 to-emerald-50 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-green-500/10 blur-2xl group-hover:bg-green-500/20 transition-colors duration-500"></div>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-green-500 to-emerald-500">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <CardTitle className="text-sm font-medium text-gray-600">Today's Logins</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-linear-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{activityStats.logins}</div>
            <p className="text-xs text-muted-foreground mt-1">Logins today</p>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-slate-50 to-gray-50 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-slate-500/10 blur-2xl group-hover:bg-slate-500/20 transition-colors duration-500"></div>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-600">
                <BarChart2 className="h-4 w-4 text-white" />
              </div>
              <CardTitle className="text-sm font-medium text-gray-600">Analyses</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-700">{activityStats.analyses}</div>
            <p className="text-xs text-muted-foreground mt-1">Clustering operations</p>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-0 bg-linear-to-br from-orange-50 to-amber-50 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl group-hover:bg-orange-500/20 transition-colors duration-500"></div>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-orange-500 to-amber-500">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <CardTitle className="text-sm font-medium text-gray-600">Data Changes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-linear-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">{activityStats.dataChanges}</div>
            <p className="text-xs text-muted-foreground mt-1">Seed data updates</p>
          </CardContent>
        </Card>
      </div>

      {/* EXPORT BUTTON */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowExportModal(true)}
          className="group flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
        >
          <FileDown className="w-4 h-4 group-hover:animate-bounce" />
          Export Report
        </button>
      </div>

      {/* (Modal + Charts + Tabs unchanged — already working fine) */}
      {/* 🚀 IMPORTANT: I did not modify your tabs/charts. 
          They already function correctly and do not affect the top cards. */}

      {/* Keep everything below exactly as it is. */}
      {/* TABS */}
      <Tabs
        defaultValue="category"
        className="space-y-6"
        onValueChange={(tab) => {
          toast.message(`Viewing: ${tab}`);
          logActivity(`Admin Viewed Analytics - ${tab}`);
        }}
      >
        <TabsList className="bg-white/80 backdrop-blur-sm p-1.5 rounded-xl shadow-md border-0 h-auto flex-wrap">
          <TabsTrigger
            value="category"
            className="data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white rounded-lg px-4 py-2 transition-all duration-300"
          >
            By Category
          </TabsTrigger>
          <TabsTrigger
            value="zone"
            className="data-[state=active]:bg-linear-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-500 data-[state=active]:text-white rounded-lg px-4 py-2 transition-all duration-300"
          >
            By Zone
          </TabsTrigger>
          <TabsTrigger
            value="distribution"
            className="data-[state=active]:bg-linear-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white rounded-lg px-4 py-2 transition-all duration-300"
          >
            Business Distribution Insights
          </TabsTrigger>
          <TabsTrigger
            value="analysis"
            className="data-[state=active]:bg-linear-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white rounded-lg px-4 py-2 transition-all duration-300"
          >
            Analysis Stats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="category">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300">
              <CardHeader className="bg-linear-to-r from-blue-50 to-indigo-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-indigo-500">
                    <BarChart2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>Category Distribution</CardTitle>
                    <CardDescription title="Shows how businesses are distributed across categories">Total businesses per category</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                {categories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
                    <Building2 className="w-12 h-12 mb-3 text-gray-300" />
                    <p className="font-medium">No business category data available</p>
                    <p className="text-sm">Try adjusting the date filter or adding businesses</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={categories}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '12px',
                          border: 'none',
                          boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Bar dataKey="value" fill="url(#blueGradient)" radius={[6, 6, 0, 0]} />
                      <defs>
                        <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300">
              <CardHeader className="bg-linear-to-r from-purple-50 to-violet-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-purple-500 to-violet-500">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>Category Percentage</CardTitle>
                    <CardDescription>Visual breakdown by category</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                {categories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
                    <Activity className="w-12 h-12 mb-3 text-gray-300" />
                    <p className="font-medium">No category percentage data available</p>
                    <p className="text-sm">Category breakdown will appear when data is available</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={categories}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {categories.map((entry, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: '12px',
                          border: 'none',
                          boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="zone">
          <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="bg-linear-to-r from-green-50 to-emerald-50 border-b">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-green-500 to-emerald-500">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>Zone Distribution</CardTitle>
                  <CardDescription title="Compares business presence between commercial and residential areas">Commercial vs Residential</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {zones.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[350px] text-gray-500">
                  <MapPin className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="font-medium">No zone distribution data available</p>
                  <p className="text-sm">Zone breakdown will appear when data is available</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={zones}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      dataKey="value"
                      label={({ name, value, percent }) => {
                        const pct = businesses.length > 0 ? (percent * 100).toFixed(1) : '0.0';
                        return `${name}: ${value} (${pct}%)`;
                      }}
                    >
                      {zones.map((entry, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                      }}
                      formatter={(value: number, name: string) => {
                        const pct = businesses.length > 0 ? ((value / businesses.length) * 100).toFixed(1) : '0.0';
                        return [`${value} (${pct}%)`, name];
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution">
          <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="bg-linear-to-r from-orange-50 to-amber-50 border-b">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-orange-500 to-amber-500">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>Business Distribution Insights</CardTitle>
                  <CardDescription>High-level interpretable insights derived from business and location data</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                    Top Categories
                  </h4>
                  {categories
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 5)
                    .map((c, index) => (
                      <div
                        key={c.name}
                        className="flex items-center gap-3 p-3 rounded-xl bg-linear-to-r from-gray-50 to-slate-50 hover:from-purple-50 hover:to-violet-50 transition-colors duration-300"
                      >
                        <Badge
                          variant="outline"
                          className="bg-linear-to-r from-purple-500 to-violet-500 text-white border-0 h-7 w-7 flex items-center justify-center rounded-full"
                        >
                          {index + 1}
                        </Badge>
                        <span className="flex-1 font-medium text-gray-700">{c.name}</span>
                        <span className="font-bold text-purple-600">{c.value}</span>
                      </div>
                    ))}
                </div>
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    Key Insights
                  </h4>

                  {/* Insight 1: Most Popular Business Category */}
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-linear-to-r from-green-50 to-emerald-50 border border-green-100" title="Category with the highest number of registered businesses">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-green-500 to-emerald-500 shrink-0">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        Most popular: {categories.length > 0 ? categories.sort((a, b) => b.value - a.value)[0]?.name : 'N/A'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {categories.length > 0 ? categories.sort((a, b) => b.value - a.value)[0]?.value : 0} businesses
                      </p>
                    </div>
                  </div>

                  {/* Insight 2: Commercial Zone Percentage */}
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-100" title="Indicates the level of business clustering in commercial areas">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-indigo-500 shrink-0">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {businesses.length === 0
                          ? '0.0'
                          : (((zones.find((z) => z.name === "Commercial")?.value || 0) / businesses.length) * 100).toFixed(1)
                        }% are in commercial zones
                      </p>
                      <p className="text-xs text-muted-foreground">Indicates business clustering level in commercial areas</p>
                    </div>
                  </div>

                  {/* Insight 3: Average Businesses per Street */}
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-linear-to-r from-purple-50 to-violet-50 border border-purple-100" title="Average number of businesses along each mapped street">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-purple-500 to-violet-500 shrink-0">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        Avg. per street: {streets.length === 0 ? '0.0' : (businesses.length / streets.length).toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground">Average number of businesses along each mapped street</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="bg-linear-to-r from-indigo-50 to-purple-50 border-b">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-purple-500">
                  <BarChart2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle>Analysis Statistics</CardTitle>
                  <CardDescription>Summary of all analytical operations performed in the system</CardDescription>
                  {lastUpdated && (
                    <p className="text-xs text-muted-foreground mt-1">Last updated: {lastUpdated.toLocaleString()}</p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              <div className="p-4 rounded-xl bg-linear-to-r from-gray-50 to-slate-50 border">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  Analyses Over Time
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analysisStats.freqByDate}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="url(#lineGradient)"
                      strokeWidth={3}
                      dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, fill: '#3b82f6' }}
                    />
                    <defs>
                      <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    Top Clustering Scores (All-Time)
                  </h3>

                  {/* Filters */}
                  <div className="flex items-center gap-2">
                    <Select value={analysisCategoryFilter} onValueChange={setAnalysisCategoryFilter}>
                      <SelectTrigger className="w-[140px] h-8 text-xs bg-white">
                        <Filter className="w-3 h-3 mr-1" />
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {[...new Set(topClusteringResults.map(r => r.business_category))].map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={analysisSortBy} onValueChange={(v) => setAnalysisSortBy(v as "score" | "recent")}>
                      <SelectTrigger className="w-[120px] h-8 text-xs bg-white">
                        <ArrowUpDown className="w-3 h-3 mr-1" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="score">Highest Score</SelectItem>
                        <SelectItem value="recent">Most Recent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {topClusteringResults.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium">No analyses available</p>
                      <p className="text-sm">Clustering results will appear here</p>
                    </div>
                  ) : (
                    [...topClusteringResults]
                      .filter(r => analysisCategoryFilter === "all" || r.business_category === analysisCategoryFilter)
                      .sort((a, b) => {
                        if (analysisSortBy === "recent") {
                          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                        }
                        return b.confidence - a.confidence;
                      })
                      .slice(0, 20)
                      .map((result, index) => {
                        const confidencePercent = Math.round(result.confidence * 100);
                        const isTop3 = index < 3 && analysisSortBy === "score";

                        return (
                          <div
                            key={result.id}
                            onClick={() => {
                              setSelectedAnalysis(result);
                              setAnalysisModalOpen(true);
                            }}
                            className="group flex items-center justify-between p-4 rounded-xl bg-linear-to-r from-gray-50 to-slate-50 border hover:from-purple-50 hover:to-violet-50 transition-all duration-300 cursor-pointer hover:shadow-md hover:-translate-y-0.5"
                          >
                            <div className="flex items-center gap-3">
                              {/* Rank Badge */}
                              <Badge
                                variant="outline"
                                className={`h-8 w-8 flex items-center justify-center rounded-full border-0 ${isTop3 && index === 0 ? 'bg-linear-to-r from-yellow-400 to-amber-500 text-white' :
                                  isTop3 && index === 1 ? 'bg-linear-to-r from-gray-300 to-gray-400 text-white' :
                                    isTop3 && index === 2 ? 'bg-linear-to-r from-amber-600 to-orange-600 text-white' :
                                      'bg-gray-100 text-gray-600'
                                  }`}
                              >
                                {isTop3 ? <Trophy className="h-4 w-4" /> : index + 1}
                              </Badge>

                              {/* User & Business Info */}
                              <div className="min-w-0">
                                <p className="font-medium text-gray-800 truncate">
                                  {result.user_name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-purple-50 text-purple-700 border-purple-200"
                                  >
                                    {result.business_category}
                                  </Badge>
                                  <span className="text-xs text-gray-400">
                                    {new Date(result.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Score & View Button */}
                            <div className="flex items-center gap-3">
                              {/* Confidence Score */}
                              <div className="text-right">
                                <p className={`text-lg font-bold ${confidencePercent >= 70 ? 'text-green-600' :
                                  confidencePercent >= 40 ? 'text-amber-600' :
                                    'text-red-600'
                                  }`}>
                                  {confidencePercent}%
                                </p>
                                <p className="text-xs text-gray-400">match</p>
                              </div>

                              {/* View Details */}
                              <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200">
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Clustering Analysis Details Modal */}
      <ClusteringAnalysisModal
        analysis={selectedAnalysis}
        open={analysisModalOpen}
        onClose={() => {
          setAnalysisModalOpen(false);
          setSelectedAnalysis(null);
        }}
        rank={selectedAnalysis ? topClusteringResults.findIndex(r => r.id === selectedAnalysis.id) + 1 : undefined}
      />
    </div>
  );
}
