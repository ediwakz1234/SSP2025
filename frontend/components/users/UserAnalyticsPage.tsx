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

  // User profile for export header
  const [userName, setUserName] = useState<string>("User");
  const [userLocation, setUserLocation] = useState<string>("");

  // Refs for capturing charts for PDF export
  const analyticsContentRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<HTMLDivElement>(null);
  const pieChartRef = useRef<HTMLDivElement>(null);
  const zoneChartRef = useRef<HTMLDivElement>(null);

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
      })).sort((a, b) => b.value - a.value);
      setStreets(streetArr);

      // Set dynamic location based on most common street
      if (streetArr.length > 0) {
        setUserLocation(streetArr[0].name);
      } else {
        setUserLocation("Location not specified");
      }

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

    // Fetch user profile for export header
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        if (profile?.full_name) {
          setUserName(profile.full_name);
        }
      }
    };
    fetchUserProfile();
  }, [loadAnalytics]);

  if (loading || !stats) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-[#1e3a5f] flex items-center justify-center mx-auto animate-pulse">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <div className="absolute inset-0 w-16 h-16 mx-auto rounded-full border-4 border-slate-200 border-t-[#1e3a5f] animate-spin" />
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

  // Enhanced Excel Export - 4 sheets matching Analytics dashboard
  const exportExcel = async () => {
    setIsExporting(true);
    toast.message("Generating Excel report...");

    try {
      const workbook = XLSX.utils.book_new();
      const totalBusinesses = stats?.total_businesses || 0;
      const timestamp = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
      const timeRange = startDate && endDate ? `${startDate} to ${endDate}` : "All Time";
      const avgPerStreet = streets.length ? (totalBusinesses / streets.length).toFixed(2) : "0";
      const avgPerZone = zones.length ? (totalBusinesses / zones.length).toFixed(2) : "0";

      // ===== SHEET 1: Overview =====
      const overviewData = [
        ["ANALYTICS REPORT"],
        ["Strategic Store Placement System"],
        [""],
        ["Prepared for", userName],
        ["Location", userLocation],
        ["Date Generated", timestamp],
        ["Time Range", timeRange],
        [""],
        ["OVERVIEW METRICS"],
        ["Metric", "Value"],
        ["Total Businesses", totalBusinesses],
        ["Avg. per Street", avgPerStreet],
        ["Avg. per Zone", avgPerZone],
        ["Business Categories", categories.length],
        ["Zone Types Count", zones.length],
      ];
      const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
      overviewSheet["!cols"] = [{ wch: 25 }, { wch: 40 }];
      // Apply bold to headers (A1, A9)
      if (overviewSheet["A1"]) overviewSheet["A1"].s = { font: { bold: true, sz: 16 } };
      if (overviewSheet["A9"]) overviewSheet["A9"].s = { font: { bold: true } };
      XLSX.utils.book_append_sheet(workbook, overviewSheet, "Overview");

      // ===== SHEET 2: Business Categories =====
      const categorySheetData = [
        ["BUSINESS CATEGORIES"],
        ["Bar Chart Data - Matches Analytics Dashboard"],
        [""],
        ["Rank", "Category", "Count", "Percentage (%)"],
      ];
      categories.forEach((cat, idx) => {
        const pct = ((cat.value / totalBusinesses) * 100).toFixed(2);
        categorySheetData.push([String(idx + 1), cat.name, String(cat.value), `${pct}%`]);
      });
      categorySheetData.push([""]);
      categorySheetData.push(["Total", "", String(totalBusinesses), "100%"]);

      const categorySheet = XLSX.utils.aoa_to_sheet(categorySheetData);
      categorySheet["!cols"] = [{ wch: 8 }, { wch: 30 }, { wch: 12 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(workbook, categorySheet, "Business Categories");

      // ===== SHEET 3: Category Percentage =====
      const pieSheetData = [
        ["CATEGORY PERCENTAGE DISTRIBUTION"],
        ["Pie Chart Data - Matches Analytics Dashboard"],
        [""],
        ["Category", "Count", "Percentage", "Visual"],
      ];
      categories.forEach(cat => {
        const pct = ((cat.value / totalBusinesses) * 100).toFixed(1);
        const barLength = Math.round(parseFloat(pct) / 5);
        const visualBar = "█".repeat(barLength) + "░".repeat(20 - barLength);
        pieSheetData.push([cat.name, String(cat.value), `${pct}%`, visualBar]);
      });

      const pieSheet = XLSX.utils.aoa_to_sheet(pieSheetData);
      pieSheet["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(workbook, pieSheet, "Category Percentage");

      // ===== SHEET 4: Zone Distribution =====
      const zoneSheetData = [
        ["ZONE DISTRIBUTION"],
        ["Zone Chart Data - Matches Analytics Dashboard"],
        [""],
        ["Zone Type", "Count", "Percentage", "Density Level"],
      ];
      zones.forEach(zone => {
        const pct = ((zone.value / totalBusinesses) * 100).toFixed(2);
        const density = zone.value >= totalBusinesses / zones.length ? "High" :
          zone.value >= totalBusinesses / (zones.length * 2) ? "Medium" : "Low";
        zoneSheetData.push([zone.name, String(zone.value), `${pct}%`, density]);
      });
      zoneSheetData.push([""]);
      zoneSheetData.push(["Total", String(totalBusinesses), "100%", ""]);

      const zoneSheet = XLSX.utils.aoa_to_sheet(zoneSheetData);
      zoneSheet["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(workbook, zoneSheet, "Zone Distribution");

      // Save the workbook
      const fileName = `SSP_Analytics_Report_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success(`Exported to Excel (4 sheets)`);
      logActivity("Exported Analytics Excel", { sheets: 4, records: totalBusinesses });
    } catch (error) {
      console.error("Excel Export Error:", error);
      toast.error("Failed to generate Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  // Enhanced PDF Export - Capture actual charts from UI
  const exportPDF = async () => {
    setIsExporting(true);
    toast.message("Generating PDF report with charts...");

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;
      const totalBusinesses = stats?.total_businesses || 0;
      const timeRange = startDate && endDate ? `${startDate} to ${endDate}` : "All Time";
      let pageNum = 1;

      const addFooter = () => {
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 8, { align: "center" });
        pdf.text("Generated by Strategic Store Placement System", pageWidth / 2, pageHeight - 4, { align: "center" });
      };

      const checkNewPage = (requiredSpace: number = 30) => {
        if (yPos > pageHeight - requiredSpace) {
          addFooter();
          pdf.addPage();
          pageNum++;
          yPos = margin;
        }
      };

      // Helper to capture chart as base64 image
      const captureChart = async (ref: React.RefObject<HTMLDivElement | null>): Promise<string | null> => {
        if (!ref.current) return null;
        try {
          const canvas = await html2canvas(ref.current, {
            backgroundColor: "#ffffff",
            scale: 2,
            useCORS: true,
            logging: false,
            onclone: (clonedDoc) => {
              // Replace oklch colors with fallback hex colors
              const allElements = clonedDoc.querySelectorAll("*");
              allElements.forEach((el) => {
                const computed = window.getComputedStyle(el);
                const styles = el as HTMLElement;

                // Replace background colors containing oklch
                if (computed.backgroundColor && computed.backgroundColor.includes("oklch")) {
                  styles.style.backgroundColor = "#ffffff";
                }
                // Replace text colors containing oklch
                if (computed.color && computed.color.includes("oklch")) {
                  styles.style.color = "#333333";
                }
                // Replace border colors containing oklch
                if (computed.borderColor && computed.borderColor.includes("oklch")) {
                  styles.style.borderColor = "#e5e7eb";
                }
              });
              // Remove backdrop-blur which can cause issues
              clonedDoc.querySelectorAll("[class*='backdrop']").forEach((el) => {
                (el as HTMLElement).style.backdropFilter = "none";
              });
            },
          });
          return canvas.toDataURL("image/png");
        } catch (err) {
          console.warn("Chart capture failed:", err);
          return null;
        }
      };

      // ===== TITLE =====
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(59, 130, 246);
      pdf.text("Analytics Report", pageWidth / 2, yPos, { align: "center" });
      yPos += 8;

      pdf.setFontSize(12);
      pdf.setTextColor(100, 100, 100);
      pdf.text("Strategic Store Placement System", pageWidth / 2, yPos, { align: "center" });
      yPos += 15;

      // ===== HEADER BOX =====
      pdf.setFillColor(240, 245, 250);
      pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 30, 3, 3, "F");
      yPos += 8;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(60, 60, 60);
      pdf.text(`Prepared for: ${userName}`, margin + 5, yPos);
      pdf.text(`Date: ${new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}`, pageWidth - margin - 5, yPos, { align: "right" });
      yPos += 7;
      pdf.text(`Location: ${userLocation}`, margin + 5, yPos);
      pdf.text(`Time Range: ${timeRange}`, pageWidth - margin - 5, yPos, { align: "right" });
      yPos += 20;

      // ===== SECTION 1: Overview Metrics =====
      pdf.setFillColor(59, 130, 246);
      pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 10, 2, 2, "F");
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("SECTION 1: Overview Metrics", margin + 5, yPos + 7);
      yPos += 18;

      pdf.setFontSize(10);
      pdf.setTextColor(30, 30, 30);
      pdf.setFont("helvetica", "normal");
      const avgPerStreet = streets.length ? (totalBusinesses / streets.length).toFixed(1) : "0";
      const avgPerZone = zones.length ? (totalBusinesses / zones.length).toFixed(1) : "0";
      const metrics = [
        `Total Businesses: ${totalBusinesses}`,
        `Avg. per Street: ${avgPerStreet}`,
        `Avg. per Zone: ${avgPerZone}`,
        `Business Categories: ${categories.length}`,
        `Zone Types Count: ${zones.length}`,
      ];
      metrics.forEach(m => { pdf.text(`• ${m}`, margin + 5, yPos); yPos += 6; });
      yPos += 10;

      // ===== SECTION 2: Business Categories (Captured Bar Chart) =====
      checkNewPage(120);
      pdf.setFillColor(16, 185, 129);
      pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 10, 2, 2, "F");
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("SECTION 2: Business Category Analytics", margin + 5, yPos + 7);
      yPos += 15;

      // Capture and embed bar chart from UI
      const barChartImage = await captureChart(barChartRef);
      if (barChartImage) {
        const chartWidth = pageWidth - margin * 2;
        const chartHeight = 55;
        pdf.addImage(barChartImage, "PNG", margin, yPos, chartWidth, chartHeight);
        yPos += chartHeight + 5;
      }

      // Summary list
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(50, 50, 50);
      categories.slice(0, 5).forEach(cat => {
        const pct = ((cat.value / totalBusinesses) * 100).toFixed(1);
        pdf.text(`• ${cat.name}: ${cat.value} (${pct}%)`, margin + 5, yPos);
        yPos += 5;
      });
      yPos += 10;

      // ===== SECTION 3: Category Percentage (Captured Pie Chart) =====
      checkNewPage(120);
      pdf.setFillColor(139, 92, 246);
      pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 10, 2, 2, "F");
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("SECTION 3: Category Percentage Distribution", margin + 5, yPos + 7);
      yPos += 15;

      // Capture and embed pie chart from UI
      const pieChartImage = await captureChart(pieChartRef);
      if (pieChartImage) {
        const chartWidth = pageWidth - margin * 2;
        const chartHeight = 55;
        pdf.addImage(pieChartImage, "PNG", margin, yPos, chartWidth, chartHeight);
        yPos += chartHeight + 10;
      }

      // ===== SECTION 4: Zone Distribution (Captured) =====
      checkNewPage(120);
      pdf.setFillColor(245, 158, 11);
      pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 10, 2, 2, "F");
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("SECTION 4: Zone Distribution", margin + 5, yPos + 7);
      yPos += 15;

      // Capture zone chart if available
      const zoneChartImage = await captureChart(zoneChartRef);
      if (zoneChartImage) {
        const chartWidth = pageWidth - margin * 2;
        const chartHeight = 55;
        pdf.addImage(zoneChartImage, "PNG", margin, yPos, chartWidth, chartHeight);
        yPos += chartHeight + 5;
      } else {
        // Fallback: show zone data as text
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(50, 50, 50);
        zones.forEach(zone => {
          const pct = ((zone.value / totalBusinesses) * 100).toFixed(1);
          pdf.text(`• ${zone.name}: ${zone.value} businesses (${pct}%)`, margin + 5, yPos);
          yPos += 6;
        });
      }
      yPos += 10;

      // ===== SECTION 5: Key Insights =====
      checkNewPage(60);
      pdf.setFillColor(99, 102, 241);
      pdf.roundedRect(margin, yPos, pageWidth - margin * 2, 10, 2, 2, "F");
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      pdf.text("SECTION 5: Key Insights", margin + 5, yPos + 7);
      yPos += 18;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(40, 40, 40);
      const topCategory = categories[0];
      const insights = [
        `Top category: ${topCategory?.name || "N/A"} with ${topCategory?.value || 0} businesses (${topCategory ? ((topCategory.value / totalBusinesses) * 100).toFixed(1) : 0}%)`,
        `Distribution behavior: ${zones.length > 1 ? "Businesses spread across multiple zone types" : "Concentrated in single zone type"}`,
        `Average business density: ${avgPerStreet} per street`,
        `Total coverage: ${streets.length} streets across ${zones.length} zone types`,
      ];
      insights.forEach(i => { checkNewPage(10); pdf.text(`• ${i}`, margin + 5, yPos); yPos += 7; });

      addFooter();
      const fileName = `SSP_Analytics_Report_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(fileName);
      toast.success("PDF exported with charts!");
      logActivity("Exported Analytics PDF", { pages: pageNum, withCharts: true });
    } catch (error) {
      console.error("PDF Export Error:", error);
      toast.error("Failed to generate PDF.");
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
      <div className="relative overflow-hidden rounded-2xl bg-[#1e3a5f] p-8 text-white shadow-xl">
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
              className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Last 7 Days
            </button>

            <button
              onClick={() => applyQuickFilter(30)}
              className="px-4 py-2.5 bg-[#1e3a5f] text-white rounded-xl font-medium hover:bg-[#2d4a6f] transition-all hover:scale-[1.02] active:scale-[0.98]"
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
              <div className="p-2 bg-[#1e3a5f] rounded-lg text-white shadow-lg shadow-slate-200">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-[#1e3a5f]">{stats.total_businesses}</div>
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
              <div className="p-2 bg-slate-600 rounded-lg text-white shadow-lg shadow-slate-200">
                <Target className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-slate-700">{categoryData.length}</div>
            <p className="text-xs text-gray-500 mt-1">Business types</p>
          </CardContent>
        </Card>
      </div>

      {/* EXPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#1e3a5f] rounded-xl text-white shadow-lg">
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
            <TabsTrigger value="category" className="rounded-lg px-6 data-[state=active]:bg-[#1e3a5f] data-[state=active]:text-white data-[state=active]:shadow-lg font-medium transition-all">
              By Category
            </TabsTrigger>
            <TabsTrigger value="zone" className="rounded-lg px-6 data-[state=active]:bg-[#1e3a5f] data-[state=active]:text-white data-[state=active]:shadow-lg font-medium transition-all">
              By Zone
            </TabsTrigger>
            <TabsTrigger value="distribution" className="rounded-lg px-6 data-[state=active]:bg-[#1e3a5f] data-[state=active]:text-white data-[state=active]:shadow-lg font-medium transition-all">
              Distribution
            </TabsTrigger>
          </TabsList>

          {/* Export Button */}
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white rounded-xl shadow-lg shadow-slate-200 transition-all hover:scale-[1.02]">
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
              <Card ref={barChartRef} className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 border-b">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-[#1e3a5f] rounded-xl text-white shadow-lg shadow-slate-200">
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
              <Card ref={pieChartRef} className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 border-b">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-600 rounded-xl text-white shadow-lg shadow-slate-200">
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
                      <Badge className="bg-[#1e3a5f] text-white border-0 shadow-md">{cat.value}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ZONE TAB */}
        <TabsContent value="zone" className="space-y-6">
          <Card ref={zoneChartRef} className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-600 rounded-xl text-white shadow-lg shadow-amber-200">
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
                          className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border hover:shadow-md transition-all"
                        >
                          <Badge className="bg-[#1e3a5f] text-white border-0 w-8 h-8 flex items-center justify-center rounded-lg">{index + 1}</Badge>
                          <span className="flex-1 text-sm font-medium text-gray-700">{cat.name}</span>
                          <span className="text-lg font-bold text-[#1e3a5f]">{cat.value}</span>
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

                    <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl border border-slate-100">
                      <div className="p-2 bg-slate-600 rounded-lg text-white">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
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
