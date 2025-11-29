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
import { toast } from "sonner";
import {
  BarChart3,
  Database,
  MapPin,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

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
  LineChart,
  Line,
  Legend,
} from "recharts";

interface SeedStats {
  total_businesses: number;
  categories: Record<string, number>;
  zones: Record<string, number>;
}

interface Analysis {
  id: number;
  business_category: string;
  confidence: number;
  created_at?: string;
  opportunity_level: string;
}

const PURPLE_COLORS = [
  "#7c3aed",
  "#a855f7",
  "#6366f1",
  "#ec4899",
  "#22c55e",
  "#f97316",
];

export function AdminAnalyticsPage() {
  const [seedStats, setSeedStats] = useState<SeedStats | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);

  // ⭐ Fetch Seed Businesses + Analyses from Supabase
  const fetchData = async () => {
    try {
      setLoading(true);

      const [businessRes, analysisRes] = await Promise.all([
        supabase.from("businesses").select("*"),
        supabase.from("clustering_results").select("*"),
      ]);

      // Seed Data
      const businesses = businessRes.data || [];

      const categories: Record<string, number> = {};
      const zones: Record<string, number> = {};

      businesses.forEach((b) => {
        categories[b.category] = (categories[b.category] || 0) + 1;
        zones[b.zone_type] = (zones[b.zone_type] || 0) + 1;
      });

      setSeedStats({
        total_businesses: businesses.length,
        categories,
        zones,
      });

      // Analyses
      setAnalyses(analysisRes.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 📊 Category distribution
  const categoryData = useMemo(
    () =>
      seedStats
        ? Object.entries(seedStats.categories).map(([name, value]) => ({
            name,
            value,
          }))
        : [],
    [seedStats]
  );

  // 📊 Zone distribution
  const zoneData = useMemo(
    () =>
      seedStats
        ? Object.entries(seedStats.zones).map(([name, value]) => ({
            name,
            value,
          }))
        : [],
    [seedStats]
  );

  // 📈 Analyses Over Time
  const analysesOverTime = useMemo(() => {
    const grouped: Record<string, number> = {};

    for (const a of analyses) {
      if (!a.created_at) continue;
      const date = new Date(a.created_at).toLocaleDateString();
      grouped[date] = (grouped[date] ?? 0) + 1;
    }

    return Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort(
        (a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
      );
  }, [analyses]);

  const totalCategories = seedStats
    ? Object.keys(seedStats.categories).length
    : 0;

  const totalZones = seedStats ? Object.keys(seedStats.zones).length : 0;

  const topCategory =
    seedStats &&
    Object.entries(seedStats.categories).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0];

  const topZone =
    seedStats &&
    Object.entries(seedStats.zones).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            Location Analytics
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Insights based on your seed businesses and clustering runs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="border-purple-200 bg-purple-50 text-xs text-purple-700"
          >
            Sta. Cruz · Santa Maria, Bulacan
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-purple-100 bg-purple-50/80">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4 text-purple-700" />
              Total businesses
            </CardTitle>
            <CardDescription>Seed dataset size</CardDescription>
          </CardHeader>
          <CardContent className="pb-3 text-2xl font-semibold">
            {seedStats?.total_businesses ?? 0}
          </CardContent>
        </Card>

        <Card className="border-purple-100">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              Business categories
            </CardTitle>
            <CardDescription>Distinct types</CardDescription>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-2xl font-semibold">{totalCategories}</div>
            {topCategory && (
              <p className="mt-1 text-xs text-muted-foreground">
                Most common:{" "}
                <span className="font-medium text-purple-700">
                  {topCategory}
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-purple-100">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-purple-600" />
              Zone types
            </CardTitle>
            <CardDescription>Based on zone_type</CardDescription>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-2xl font-semibold">{totalZones}</div>
            {topZone && (
              <p className="mt-1 text-xs text-muted-foreground">
                Most dense:{" "}
                <span className="font-medium text-purple-700">
                  {topZone}
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-purple-100">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              Total analyses
            </CardTitle>
            <CardDescription>K-Means runs performed</CardDescription>
          </CardHeader>
          <CardContent className="pb-3 text-2xl font-semibold">
            {analyses.length}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Category distribution */}
        <Card className="border-purple-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Category distribution</CardTitle>
            <CardDescription>
              How existing businesses are distributed across types.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {categoryData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    radius={[4, 4, 0, 0]}
                    fill="#7c3aed"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                No category data available yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Zone distribution */}
        <Card className="border-purple-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Zone distribution</CardTitle>
            <CardDescription>
              How businesses are distributed across zone types.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            {zoneData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={zoneData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    label
                  >
                    {zoneData.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={PURPLE_COLORS[idx % PURPLE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                No zone data available yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analyses over time */}
      <Card className="border-purple-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Analyses over time</CardTitle>
          <CardDescription>
            Trend of K-Means runs based on your clustering history.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[260px]">
          {analysesOverTime.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analysesOverTime}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={10} />
                <YAxis allowDecimals={false} fontSize={10} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              No analyses recorded yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
