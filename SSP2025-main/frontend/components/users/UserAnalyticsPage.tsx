// Merged Analytics Page combining full UI with realtime Supabase data
// Final Clean + Export Modal + Category Normalization + Icons + User-friendly features
// ⭐ Now includes DATE RANGE FILTER + QUICK FILTERS
// ⭐ Export: PDF (full visuals) + Excel (full datasets) - CSV removed

import { useState, useEffect, useCallback, useRef } from "react";
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
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
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
  const [isExporting, setIsExporting] = useState(false);

  // Ref for capturing analytics content for PDF export
  const analyticsContentRef = useRef<HTMLDivElement>(null);

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
        "pet store": "Services",
        "pet stores": "Services",
        "pets": "Services",
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

  // Enhanced Excel Export with multiple sheets containing full datasets
  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();
    const totalBusinesses = stats?.total_businesses || 0;

    // Sheet 1: Summary
    const summaryData = [
      { Metric: "Total Businesses", Value: totalBusinesses },
      { Metric: "Total Categories", Value: categories.length },
      { Metric: "Total Zone Types", Value: zones.length },
      { Metric: "Total Streets", Value: streets.length },
      { Metric: "Avg. Businesses per Street", Value: streets.length ? (totalBusinesses / streets.length).toFixed(2) : "0" },
      { Metric: "Avg. Businesses per Zone", Value: zones.length ? (totalBusinesses / zones.length).toFixed(2) : "0" },
      { Metric: "Report Generated", Value: new Date().toLocaleString() },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    // Sheet 2: Categories (full breakdown)
    const categorySheetData = categories.map((c) => ({
      Category: c.name,
      Count: c.value,
      Percentage: ((c.value / totalBusinesses) * 100).toFixed(2) + "%",
    }));
    const categorySheet = XLSX.utils.json_to_sheet(categorySheetData);
    XLSX.utils.book_append_sheet(workbook, categorySheet, "Categories");

    // Sheet 3: Zones (full breakdown)
    const zoneSheetData = zones.map((z) => ({
      "Zone Type": z.name,
      Count: z.value,
      Percentage: ((z.value / totalBusinesses) * 100).toFixed(2) + "%",
    }));
    const zoneSheet = XLSX.utils.json_to_sheet(zoneSheetData);
    XLSX.utils.book_append_sheet(workbook, zoneSheet, "Zones");

    // Sheet 4: Streets (full breakdown)
    const streetSheetData = streets
      .sort((a, b) => b.value - a.value)
      .map((s) => ({
        Street: s.name,
        "Business Count": s.value,
        Percentage: ((s.value / totalBusinesses) * 100).toFixed(2) + "%",
      }));
    const streetSheet = XLSX.utils.json_to_sheet(streetSheetData);
    XLSX.utils.book_append_sheet(workbook, streetSheet, "Streets");

    // Sheet 5: Raw Data (all business records)
    const rawData = businesses.map((b) => ({
      "Business Name": b.business_name || "N/A",
      Category: b.general_category || "N/A",
      "Zone Type": b.zone_type || "N/A",
      Street: b.street || "N/A",
      Status: b.status || "N/A",
      "Created At": b.created_at || "N/A",
    }));
    const rawDataSheet = XLSX.utils.json_to_sheet(rawData);
    XLSX.utils.book_append_sheet(workbook, rawDataSheet, "Raw Data");

    // Save the workbook
    const fileName = `business_analytics_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Enhanced PDF Export with full visual content using html2canvas
  const exportPDF = async () => {
    if (!analyticsContentRef.current) {
      toast.error("Unable to capture analytics content");
      return;
    }

    setIsExporting(true);
    toast.message("Generating PDF with all charts and data...");

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      // Title
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(59, 130, 246); // Blue
      pdf.text("Business Analytics Report", pageWidth / 2, yPos, { align: "center" });
      yPos += 10;

      // Subtitle with date
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 15;

      // Summary Statistics Section
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(0, 0, 0);
      pdf.text("Summary Statistics", margin, yPos);
      yPos += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const totalBusinesses = stats?.total_businesses || 0;
      const summaryItems = [
        `Total Businesses: ${totalBusinesses}`,
        `Categories: ${categories.length}`,
        `Zone Types: ${zones.length}`,
        `Streets Covered: ${streets.length}`,
        `Avg. per Street: ${streets.length ? (totalBusinesses / streets.length).toFixed(1) : 0}`,
        `Avg. per Zone: ${zones.length ? (totalBusinesses / zones.length).toFixed(1) : 0}`,
      ];
      summaryItems.forEach((item) => {
        pdf.text(`• ${item}`, margin + 5, yPos);
        yPos += 6;
      });
      yPos += 10;

      // Capture the analytics content as image
      const canvas = await html2canvas(analyticsContentRef.current, {
        scale: 2, // High quality
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Add new page if needed for the chart image
      if (yPos + 50 > pageHeight) {
        pdf.addPage();
        yPos = margin;
      }

      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Visual Analytics", margin, yPos);
      yPos += 8;

      // Add the captured image (may span multiple pages)
      let remainingHeight = imgHeight;
      let sourceY = 0;
      const maxImageHeightPerPage = pageHeight - yPos - margin;

      while (remainingHeight > 0) {
        const heightToDraw = Math.min(remainingHeight, maxImageHeightPerPage);
        const sourceHeight = (heightToDraw / imgHeight) * canvas.height;

        // Create a temporary canvas for the slice
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = canvas.width;
        tempCanvas.height = sourceHeight;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          tempCtx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
          const sliceData = tempCanvas.toDataURL("image/png");
          pdf.addImage(sliceData, "PNG", margin, yPos, imgWidth, heightToDraw);
        }

        remainingHeight -= heightToDraw;
        sourceY += sourceHeight;

        if (remainingHeight > 0) {
          pdf.addPage();
          yPos = margin;
        }
      }

      // Add a new page for data tables
      pdf.addPage();
      yPos = margin;

      // Categories Table
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Category Breakdown", margin, yPos);
      yPos += 8;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      categories.forEach((cat, idx) => {
        if (yPos > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }
        const percentage = ((cat.value / totalBusinesses) * 100).toFixed(1);
        pdf.text(`${idx + 1}. ${cat.name}: ${cat.value} (${percentage}%)`, margin + 5, yPos);
        yPos += 5;
      });
      yPos += 10;

      // Zone Distribution Table
      if (yPos > pageHeight - 40) {
        pdf.addPage();
        yPos = margin;
      }
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Zone Distribution", margin, yPos);
      yPos += 8;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      zones.forEach((zone) => {
        if (yPos > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }
        const percentage = ((zone.value / totalBusinesses) * 100).toFixed(1);
        pdf.text(`• ${zone.name}: ${zone.value} businesses (${percentage}%)`, margin + 5, yPos);
        yPos += 5;
      });
      yPos += 10;

      // Key Insights Section
      if (yPos > pageHeight - 60) {
        pdf.addPage();
        yPos = margin;
      }
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Key Insights", margin, yPos);
      yPos += 8;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      const insights = [
        `Most popular category: ${categories[0]?.name || "N/A"} with ${categories[0]?.value || 0} businesses`,
        `Commercial zone coverage: ${((zones.find((z) => z.name === "Commercial")?.value || 0) / totalBusinesses * 100).toFixed(1)}%`,
        `Average business density: ${streets.length ? (totalBusinesses / streets.length).toFixed(1) : 0} per street`,
        `Top 3 categories account for ${categories.slice(0, 3).reduce((acc, c) => acc + c.value, 0)} businesses (${((categories.slice(0, 3).reduce((acc, c) => acc + c.value, 0) / totalBusinesses) * 100).toFixed(1)}%)`,
      ];
      insights.forEach((insight) => {
        pdf.text(`• ${insight}`, margin + 5, yPos, { maxWidth: pageWidth - margin * 2 - 10 });
        yPos += 6;
      });

      // Save the PDF
      const fileName = `business_analytics_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error("PDF Export Error:", error);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
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
              {/* PDF Export - Full visuals and data */}
              <button
                onClick={async () => {
                  setShowExportModal(false);
                  await exportPDF();
                  toast.success("Exported analytics as PDF with all charts and data");
                  logActivity("Exported Analytics Report", { format: "PDF", content: "full_visuals" });
                }}
                disabled={isExporting}
                className="w-full h-16 flex items-center gap-4 bg-red-50 hover:bg-red-100 px-5 rounded-xl transition-all hover:scale-[1.02] border-2 border-transparent hover:border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="p-2.5 bg-red-200 rounded-lg">
                  <FileDown className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-red-700 block">Export as PDF</span>
                  <span className="text-xs text-red-500">Full visuals, charts &amp; insights</span>
                </div>
              </button>

              {/* Excel Export - Full datasets */}
              <button
                onClick={() => {
                  exportExcel();
                  toast.success("Exported analytics as Excel (5 sheets)");
                  logActivity("Exported Analytics Report", { format: "Excel", sheets: 5, content: "full_datasets" });
                  setShowExportModal(false);
                }}
                disabled={isExporting}
                className="w-full h-16 flex items-center gap-4 bg-green-50 hover:bg-green-100 px-5 rounded-xl transition-all hover:scale-[1.02] border-2 border-transparent hover:border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="p-2.5 bg-green-200 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-green-700 block">Export as Excel (.xlsx)</span>
                  <span className="text-xs text-green-500">Full datasets &amp; raw data (5 sheets)</span>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowExportModal(false)}
              disabled={isExporting}
              className="w-full h-12 rounded-xl bg-linear-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white font-medium transition-all disabled:opacity-50"
            >
              {isExporting ? "Exporting..." : "Close"}
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
          {/* Wrapper for PDF capture */}
          <div ref={analyticsContentRef}>
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
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden mt-6">
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
          </div>
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
