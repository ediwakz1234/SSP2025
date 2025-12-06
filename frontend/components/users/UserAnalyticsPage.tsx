// Merged Analytics Page combining full UI with realtime Supabase data
// Final Clean + Export Modal + Category Normalization + Icons + User-friendly features
// ⭐ Now includes DATE RANGE FILTER + QUICK FILTERS

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
} from "recharts";
import {
  Activity,
  TrendingUp,
  Users,
  MapPin,
  Building2,
  Target,
  FileDown,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { useActivity, logActivity } from "../../utils/activity";
import { toast } from "sonner";
import type { Business } from "../../types";

interface AnalyticsStats {
  totalBusinesses: number;
  total_businesses: number;
  totalCategories: number;
  commercialZones: number;
  residentialZones: number;
  avgDensity: number;
  categories: { name: string; value: number }[];
  zones: { name: string; value: number }[];
}

export function UserAnalyticsPage() {
  useActivity();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<
    { name: string; value: number }[]
  >([]);
  const [zones, setZones] = useState<{ name: string; value: number }[]>([]);
  const [streets, setStreets] = useState<{ name: string; value: number }[]>([]);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);

  // Date filter states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // QUICK FILTER function
  const applyQuickFilter = (days?: number | "year") => {
    if (days === 0) {
      toast.message("Filtering analytics: Today");
      logActivity("Filtered Analytics", { range: "Today" });
    } else if (days === 7) {
      toast.message("Filtering analytics: Last 7 days");
      logActivity("Filtered Analytics", { range: "Last 7 Days" });
    } else if (days === 30) {
      toast.message("Filtering analytics: Last 30 days");
      logActivity("Filtered Analytics", { range: "Last 30 Days" });
    } else if (days === "year") {
      toast.message("Filtering analytics: This Year");
      logActivity("Filtered Analytics", { range: "This Year" });
    }


    const today = new Date();
    const end = today.toISOString().split("T")[0];

    if (days === "year") {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(end);
      loadAnalytics(true);
      return;
    }

    const start = new Date();
    start.setDate(today.getDate() - days!);

    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end);
    loadAnalytics(true);
  };

  // Load analytics (supports date filtering)
  const loadAnalytics = useCallback(
    async (applyFilter: boolean = false) => {
      setLoading(true);

      let query = supabase.from("businesses").select("*");

      // APPLY DATE FILTER
      if (applyFilter && startDate && endDate) {
        query = query
          .gte("created_at", `${startDate}T00:00:00`)
          .lte("created_at", `${endDate}T23:59:59`);
      }

      const { data: bizData } = await query;
      const list = bizData || [];
      setBusinesses(list);

      // Standard category names (must match DB values)
      const STANDARD_CATEGORIES: Record<string, string> = {
        "retail": "Retail",
        "services": "Services",
        "service": "Services",
        "restaurant": "Restaurant",
        "restaurants": "Restaurant",
        "food & beverages": "Food / Beverages",
        "food and beverages": "Food / Beverages",
        "food/beverages": "Food / Beverages",
        "food / beverages": "Food / Beverages",
        "f&b": "Food / Beverages",
        "entertainment / leisure": "Entertainment / Leisure",
        "entertainment/leisure": "Entertainment / Leisure",
        "entertainment and leisure": "Entertainment / Leisure",
        "entertainment": "Entertainment / Leisure",
        "leisure": "Entertainment / Leisure",
        "merchandise / trading": "Merchandise / Trading",
        "merchandise/trading": "Merchandise / Trading",
        "merchandising / trading": "Merchandise / Trading",
        "merchandising/trading": "Merchandise / Trading",
        "merchandizing / trading": "Merchandise / Trading",
        "merchandizing/trading": "Merchandise / Trading",
        "trading": "Merchandise / Trading",
        "merchandise": "Merchandise / Trading",
        "pet store": "Pet Store",
        "pet stores": "Pet Store",
        "pets": "Pet Store",
      };

      // Category normalization function
      const normalizeCategoryName = (name: string): string => {
        if (!name || typeof name !== 'string') return "Unknown";

        const cleaned = name.trim().toLowerCase();
        if (!cleaned) return "Unknown";

        // Check for exact match in standard categories
        if (STANDARD_CATEGORIES[cleaned]) {
          return STANDARD_CATEGORIES[cleaned];
        }

        // Check for partial matches
        for (const [key, value] of Object.entries(STANDARD_CATEGORIES)) {
          if (cleaned.includes(key) || key.includes(cleaned)) {
            return value;
          }
        }

        // Fallback: Title case the original
        return name.trim().replace(/\w\S*/g, (txt) =>
          txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
        );
      };

      // CATEGORY AGGREGATION
      const catMap = new Map<string, number>();
      list.forEach((b) => {
        const rawCategory = b.general_category;
        if (rawCategory) {
          const normalized = normalizeCategoryName(rawCategory);
          catMap.set(normalized, (catMap.get(normalized) || 0) + 1);
        }
      });

      // Convert to array and sort by count (highest first)
      const catArr = Array.from(catMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
      setCategories(catArr);

      // ZONE AGGREGATION
      const zoneMap = new Map();
      list.forEach((b) => {
        if (b.zone_type) {
          zoneMap.set(b.zone_type, (zoneMap.get(b.zone_type) || 0) + 1);
        }
      });
      const zoneArr = Array.from(zoneMap).map(([name, value]) => ({
        name,
        value,
      }));
      setZones(zoneArr);

      // STREET AGGREGATION
      const streetMap = new Map();
      list.forEach((b) => {
        if (b.street)
          streetMap.set(b.street, (streetMap.get(b.street) || 0) + 1);
      });
      const streetArr = Array.from(streetMap).map(([name, value]) => ({
        name,
        value,
      }));
      setStreets(streetArr);

      // STATS
      setStats({
        totalBusinesses: list.length,
        total_businesses: list.length,
        totalCategories: catArr.length,
        commercialZones: zoneArr.filter(z => z.name === 'Commercial').reduce((acc, z) => acc + z.value, 0),
        residentialZones: zoneArr.filter(z => z.name === 'Residential').reduce((acc, z) => acc + z.value, 0),
        avgDensity: list.length / (streetArr.length || 1),
        categories: catArr,
        zones: zoneArr,
      });

      setLoading(false);
    },
    [startDate, endDate]
  );

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading || !stats) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto animate-pulse">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <div className="absolute inset-0 w-16 h-16 mx-auto rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin" />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">Loading Analytics</p>
            <p className="text-sm text-gray-500">Crunching the numbers...</p>
          </div>
        </div>
      </div>
    );
  }


  const categoryData = categories;
  const zoneData = zones;

  const COLORS = [
    "#3b82f6",
    "#8b5cf6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#06b6d4",
  ];

  // ========================
  // EXPORT FUNCTIONS
  // ========================

  const exportCSV = () => {
    const rows = [
      ["Category", "Count"],
      ...categories.map((c) => [c.name, c.value]),
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows.map((e) => e.join(",")).join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "business_analytics.csv";
    link.click();
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(categories);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Categories");
    XLSX.writeFile(wb, "business_analytics.xlsx");
  };

  const exportPDF = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text("Business Analytics Report", 10, 10);

    pdf.setFontSize(12);
    let y = 20;

    categories.forEach((c) => {
      pdf.text(`${c.name}: ${c.value}`, 10, y);
      y += 8;
    });

    pdf.save("business_analytics.pdf");
  };


  // ========================
  // RETURN UI
  // ========================

  return (
    <div className="page-wrapper space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-blue-600 via-indigo-600 to-violet-700 p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-white/5 mask-[radial-gradient(ellipse_at_center,black_50%,transparent_100%)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Activity className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Business Analytics</h1>
              <p className="text-blue-100">Comprehensive distribution insights and data visualization</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm">
              <Building2 className="w-4 h-4" />
              <span className="text-sm font-medium">{stats.total_businesses} Total Businesses</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm">
              <Target className="w-4 h-4" />
              <span className="text-sm font-medium">{categoryData.length} Categories</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium">{zones.length} Zone Types</span>
            </div>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      {/* Date Range Filter Card */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
        <CardHeader className="bg-linear-to-r from-slate-50 to-gray-50 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-linear-to-br from-slate-600 to-gray-700 rounded-xl text-white shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </div>
            <div>
              <CardTitle className="text-lg">Filter by Date Range</CardTitle>
              <CardDescription>Select a time period to analyze</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          {/* Date Selectors */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex flex-col flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-12 border-2 rounded-xl px-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              />
            </div>

            <div className="flex flex-col flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-12 border-2 rounded-xl px-4 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              />
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => applyQuickFilter(0)}
              className="px-4 py-2.5 bg-linear-to-r from-gray-100 to-gray-200 rounded-xl font-medium hover:from-gray-200 hover:to-gray-300 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Today
            </button>

            <button
              onClick={() => applyQuickFilter(7)}
              className="px-4 py-2.5 bg-linear-to-r from-blue-100 to-indigo-100 text-blue-700 rounded-xl font-medium hover:from-blue-200 hover:to-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Last 7 Days
            </button>

            <button
              onClick={() => applyQuickFilter(30)}
              className="px-4 py-2.5 bg-linear-to-r from-purple-100 to-violet-100 text-purple-700 rounded-xl font-medium hover:from-purple-200 hover:to-violet-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Last 30 Days
            </button>

            <button
              onClick={() => applyQuickFilter("year")}
              className="px-4 py-2.5 bg-linear-to-r from-emerald-100 to-green-100 text-emerald-700 rounded-xl font-medium hover:from-emerald-200 hover:to-green-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              This Year
            </button>

            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
                toast.message("Analytics date filter reset");
                logActivity("Reset Analytics Date Filter");
                loadAnalytics();
              }}
              className="px-4 py-2.5 bg-linear-to-r from-red-100 to-rose-100 text-red-700 rounded-xl font-medium hover:from-red-200 hover:to-rose-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Reset Filter
            </button>
          </div>

          {startDate && endDate && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
              <p className="text-sm text-blue-700">
                Showing results from <span className="font-semibold">{startDate}</span> to <span className="font-semibold">{endDate}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* TOP CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden group hover:shadow-xl transition-all hover:scale-[1.02]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Total Businesses</CardTitle>
              <div className="p-2 bg-linear-to-br from-blue-500 to-indigo-600 rounded-lg text-white shadow-lg shadow-blue-200">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{stats.total_businesses}</div>
            <p className="text-xs text-gray-500 mt-1">Active locations</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden group hover:shadow-xl transition-all hover:scale-[1.02]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Avg. per Street</CardTitle>
              <div className="p-2 bg-linear-to-br from-emerald-500 to-green-600 rounded-lg text-white shadow-lg shadow-emerald-200">
                <Users className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold bg-linear-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
              {streets.length
                ? (businesses.length / streets.length).toFixed(1)
                : 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">Per area</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden group hover:shadow-xl transition-all hover:scale-[1.02]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Avg. per Zone</CardTitle>
              <div className="p-2 bg-linear-to-br from-amber-500 to-orange-600 rounded-lg text-white shadow-lg shadow-amber-200">
                <Activity className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold bg-linear-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              {zones.length
                ? (businesses.length / zones.length).toFixed(1)
                : 0}
            </div>
            <p className="text-xs text-gray-500 mt-1">Based on zone distribution</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden group hover:shadow-xl transition-all hover:scale-[1.02]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Categories</CardTitle>
              <div className="p-2 bg-linear-to-br from-purple-500 to-violet-600 rounded-lg text-white shadow-lg shadow-purple-200">
                <Target className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold bg-linear-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">{categoryData.length}</div>
            <p className="text-xs text-gray-500 mt-1">Business types</p>
          </CardContent>
        </Card>
      </div>

      {/* EXPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-linear-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-lg">
                <FileDown className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Export Report</h2>
                <p className="text-sm text-gray-500">Choose your preferred format</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  exportCSV();
                  toast.success("Exported analytics as CSV");
                  logActivity("Exported Analytics Report", { format: "CSV" });
                  setShowExportModal(false);
                }}
                className="w-full h-14 flex items-center gap-3 bg-gray-50 hover:bg-gray-100 px-4 rounded-xl transition-all hover:scale-[1.02] border-2 border-transparent hover:border-gray-200"
              >
                <div className="p-2 bg-gray-200 rounded-lg">
                  <FileText className="w-5 h-5 text-gray-600" />
                </div>
                <span className="font-medium">Export as CSV</span>
              </button>

              <button
                onClick={() => {
                  exportExcel();
                  toast.success("Exported analytics as Excel");
                  logActivity("Exported Analytics Report", { format: "Excel" });
                  setShowExportModal(false);
                }}
                className="w-full h-14 flex items-center gap-3 bg-green-50 hover:bg-green-100 px-4 rounded-xl transition-all hover:scale-[1.02] border-2 border-transparent hover:border-green-200"
              >
                <div className="p-2 bg-green-200 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                </div>
                <span className="font-medium text-green-700">Export as Excel (.xlsx)</span>
              </button>

              <button
                onClick={() => {
                  exportPDF();
                  toast.success("Exported analytics as PDF");
                  logActivity("Exported Analytics Report", { format: "PDF" });
                  setShowExportModal(false);
                }}
                className="w-full h-14 flex items-center gap-3 bg-red-50 hover:bg-red-100 px-4 rounded-xl transition-all hover:scale-[1.02] border-2 border-transparent hover:border-red-200"
              >
                <div className="p-2 bg-red-200 rounded-lg">
                  <FileDown className="w-5 h-5 text-red-600" />
                </div>
                <span className="font-medium text-red-700">Export as PDF</span>
              </button>
            </div>

            <button
              onClick={() => setShowExportModal(false)}
              className="w-full h-12 rounded-xl bg-linear-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white font-medium transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* TABS */}
      <Tabs
        defaultValue="category"
        className="space-y-6"
        onValueChange={(value) => {
          if (value === "category") {
            toast.message("Viewing analytics by category");
            logActivity("Viewed Analytics - By Category");
          }
          if (value === "zone") {
            toast.message("Viewing analytics by zone");
            logActivity("Viewed Analytics - By Zone");
          }
          if (value === "distribution") {
            toast.message("Viewing business distribution insights");
            logActivity("Viewed Analytics - Distribution");
          }
        }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <TabsList className="h-14 bg-white/80 backdrop-blur-sm shadow-lg rounded-xl p-1.5">
            <TabsTrigger value="category" className="rounded-lg px-6 data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg font-medium transition-all">
              By Category
            </TabsTrigger>
            <TabsTrigger value="zone" className="rounded-lg px-6 data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg font-medium transition-all">
              By Zone
            </TabsTrigger>
            <TabsTrigger value="distribution" className="rounded-lg px-6 data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg font-medium transition-all">
              Distribution
            </TabsTrigger>
          </TabsList>

          {/* Export Button */}
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl shadow-lg shadow-blue-200 transition-all hover:scale-[1.02]"
          >
            <FileDown className="w-5 h-5" />
            Export Report
          </button>
        </div>

        {/* CATEGORY TAB */}
        <TabsContent value="category" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* BAR CHART */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-linear-to-r from-blue-50 to-indigo-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-linear-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-200">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Business Count by Category</CardTitle>
                    <CardDescription>Distribution of business types</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Bar dataKey="value" fill="url(#colorGradient)" radius={[8, 8, 0, 0]} />
                    <defs>
                      <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* PIE CHART */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-linear-to-r from-purple-50 to-violet-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-linear-to-br from-purple-500 to-violet-600 rounded-xl text-white shadow-lg shadow-purple-200">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Category Percentage</CardTitle>
                    <CardDescription>Proportional distribution</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* SUMMARY */}
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-linear-to-r from-emerald-50 to-teal-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-linear-to-br from-emerald-500 to-teal-600 rounded-xl text-white shadow-lg shadow-emerald-200">
                  <Building2 className="w-5 h-5" />
                </div>
                <CardTitle className="text-lg">Category Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-3 gap-4">
                {categoryData.map((cat, index) => (
                  <div
                    key={cat.name}
                    className="flex items-center justify-between p-4 bg-linear-to-r from-gray-50 to-slate-50 border rounded-xl hover:shadow-md transition-all hover:scale-[1.02] group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full shadow-sm"
                        style={{
                          backgroundColor:
                            COLORS[index % COLORS.length],
                        }}
                      />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">{cat.name}</span>
                    </div>
                    <Badge className="bg-linear-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-md">{cat.value}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ZONE TAB */}
        <TabsContent value="zone" className="space-y-6">
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-linear-to-r from-amber-50 to-orange-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-linear-to-br from-amber-500 to-orange-600 rounded-xl text-white shadow-lg shadow-amber-200">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Zone Distribution</CardTitle>
                  <CardDescription>Commercial vs Residential areas</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={zoneData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) =>
                      `${name}: ${value}`
                    }
                    outerRadius={120}
                    dataKey="value"
                  >
                    {zoneData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ZONE SUMMARY */}
          <div className="grid md:grid-cols-2 gap-5">
            {zoneData.map((zone, index) => (
              <Card key={zone.name} className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden hover:shadow-2xl transition-all hover:scale-[1.02]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    {zone.name} Zone
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold bg-linear-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent mb-2">{zone.value}</div>
                  <p className="text-sm text-gray-500">
                    {(
                      (zone.value / stats.total_businesses) *
                      100
                    ).toFixed(1)}% of total businesses
                  </p>
                  <div className="h-3 bg-gray-100 rounded-full mt-4 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(zone.value / stats.total_businesses) *
                          100
                          }%`,
                        backgroundColor:
                          COLORS[index % COLORS.length],
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* DISTRIBUTION TAB */}
        <TabsContent value="distribution" className="space-y-6">
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-linear-to-r from-rose-50 to-pink-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-linear-to-br from-rose-500 to-pink-600 rounded-xl text-white shadow-lg shadow-rose-200">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Business Distribution Overview</CardTitle>
                  <CardDescription>Comprehensive analysis of all business data</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* TOP CATEGORIES */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-500" />
                    Top Business Categories
                  </h4>
                  <div className="space-y-3">
                    {categoryData
                      .sort((a, b) => b.value - a.value)
                      .slice(0, 5)
                      .map((cat, index) => (
                        <div
                          key={cat.name}
                          className="flex items-center gap-3 p-3 bg-linear-to-r from-gray-50 to-slate-50 rounded-xl border hover:shadow-md transition-all"
                        >
                          <Badge className="bg-linear-to-r from-purple-500 to-violet-600 text-white border-0 w-8 h-8 flex items-center justify-center rounded-lg">{index + 1}</Badge>
                          <span className="flex-1 text-sm font-medium text-gray-700">{cat.name}</span>
                          <span className="text-lg font-bold text-purple-600">{cat.value}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* INSIGHTS */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-500" />
                    Key Insights
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-linear-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
                      <div className="p-2 bg-green-500 rounded-lg text-white">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-green-900">
                          Most popular: {categoryData[0]?.name}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {categoryData[0]?.value} businesses
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-linear-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                      <div className="p-2 bg-blue-500 rounded-lg text-white">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-blue-900">
                          {(
                            ((zoneData.find(
                              (z) => z.name === "Commercial"
                            )?.value || 0) /
                              stats.total_businesses) *
                            100
                          ).toFixed(1)}% in commercial zones
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          High business concentration
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-linear-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-100">
                      <div className="p-2 bg-purple-500 rounded-lg text-white">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-purple-900">
                          Avg. per Street: {streets.length ? (businesses.length / streets.length).toFixed(1) : 0}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Business density per area
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}
