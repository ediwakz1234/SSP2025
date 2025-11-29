import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/card";
import { Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Legend,
  ScatterChart,
  Scatter,
} from "recharts";
import { supabase } from "../../lib/supabase";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* ---------------------- Types ---------------------- */
type Business = {
  id: number;
  business_name: string;
  category: string;
  zone_type: string;
  street?: string;
  created_at?: string;
  latitude?: number;
  longitude?: number;
};

type CategoryCount = { category: string; count: number };
type ZoneCount = { zone_type: string; count: number };
type StreetCount = { street: string; count: number };

type ClusterCentroid = {
  cluster_id: number;
  latitude: number;
  longitude: number;
  density: number;
  color?: string;
};

/* ---------------------- Component ---------------------- */
export function UserAnalyticsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [zones, setZones] = useState<ZoneCount[]>([]);
  const [streets, setStreets] = useState<StreetCount[]>([]);
  const [clusterCentroids, setClusterCentroids] = useState<ClusterCentroid[]>([]);
  const [loading, setLoading] = useState(true);

  /* ---------------------- Filters ---------------------- */
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  /* ---------------------- Export CSV ---------------------- */
  const exportFullCSV = () => {
    const lines: string[] = [];

    const totalBusinesses = businesses.length;
    const totalCategories = categories.length;
    const avgPerCategory =
      totalCategories > 0 ? (totalBusinesses / totalCategories).toFixed(1) : "0";

    lines.push("SUMMARY");
    lines.push(`Total Businesses,${totalBusinesses}`);
    lines.push(`Business Categories,${totalCategories}`);
    lines.push(`Average per Category,${avgPerCategory}`);
    lines.push("");

    lines.push("CATEGORIES");
    lines.push("Category,Count");
    categories.forEach((c) => lines.push(`${c.category},${c.count}`));
    lines.push("");

    lines.push("ZONES");
    lines.push("Zone Type,Count");
    zones.forEach((z) => lines.push(`${z.zone_type},${z.count}`));
    lines.push("");

    lines.push("STREETS (Business Density)");
    lines.push("Street,Count");
    streets.forEach((s) => lines.push(`${s.street},${s.count}`));
    lines.push("");

    lines.push("CLUSTERS");
    lines.push("Cluster ID,Latitude,Longitude,Density");
    clusterCentroids.forEach((c) =>
      lines.push(`${c.cluster_id},${c.latitude},${c.longitude},${c.density}`)
    );
    lines.push("");

    lines.push("BUSINESSES");
    lines.push("ID,Business Name,Category,Zone,Street,Created At");
    businesses.forEach((b) => {
      lines.push(
        [
          b.id,
          `"${b.business_name}"`,
          b.category,
          b.zone_type,
          b.street ?? "",
          b.created_at ?? "",
        ].join(",")
      );
    });

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "business_analytics_report.csv";
    link.click();
  };

  /* ---------------------- Export PDF ---------------------- */
  const exportFullPDF = async () => {
    const container = document.getElementById("analytics-report");
    if (!container) return;

    const doc = new jsPDF("p", "mm", "a4");

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
    });
    const imgData = canvas.toDataURL("image/png");

    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = pdfHeight;
    let position = 0;

    doc.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
    heightLeft -= doc.internal.pageSize.getHeight();

    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      doc.addPage();
      doc.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= doc.internal.pageSize.getHeight();
    }

    doc.save("business_analytics_report.pdf");
  };

  /* ---------------------- Load Analytics ---------------------- */
  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase.from("businesses").select("*");

      if (selectedCategory !== "all") query = query.eq("category", selectedCategory);
      if (selectedZone !== "all") query = query.eq("zone_type", selectedZone);

      // Date filters
      let sinceISO: string | null = null;
      if (dateRange !== "all") {
        const now = new Date();
        const ranges: Record<string, number> = {
          "7d": 7,
          "30d": 30,
          "90d": 90,
          "1y": 365,
        };
        const since = new Date(now.getTime() - ranges[dateRange] * 86400000);
        sinceISO = since.toISOString();
        query = query.gte("created_at", sinceISO);
      }

      if (searchTerm.trim() !== "") {
        const term = `%${searchTerm.trim()}%`;
        query = query.or(`business_name.ilike.${term},street.ilike.${term}`);
      }

      const { data: bizData } = await query;
      const businessList = (bizData || []) as Business[];
      setBusinesses(businessList);

      // Aggregations
      setCategories(
        Array.from(
          businessList.reduce((map, b) => {
            if (b.category) map.set(b.category, (map.get(b.category) || 0) + 1);
            return map;
          }, new Map<string, number>())
        ).map(([category, count]) => ({ category, count }))
      );

      setZones(
        Array.from(
          businessList.reduce((map, b) => {
            if (b.zone_type) map.set(b.zone_type, (map.get(b.zone_type) || 0) + 1);
            return map;
          }, new Map<string, number>())
        ).map(([zone_type, count]) => ({ zone_type, count }))
      );

      setStreets(
        Array.from(
          businessList.reduce((map, b) => {
            if (b.street) map.set(b.street, (map.get(b.street) || 0) + 1);
            return map;
          }, new Map<string, number>())
        ).map(([street, count]) => ({ street, count }))
      );

      // RPC Clusters (clusterRadius removed)
      const { data: clusterData } = await supabase.rpc("get_business_clusters", {
        p_category: selectedCategory !== "all" ? selectedCategory : null,
        p_zone_type: selectedZone !== "all" ? selectedZone : null,
        p_since: sinceISO,
        p_radius: null,
      });

      const COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

      setClusterCentroids(
        (clusterData || []).map((c: any, idx: number) => ({
          cluster_id: c.cluster_id,
          latitude: c.latitude,
          longitude: c.longitude,
          density: c.density,
          color: COLORS[idx % COLORS.length],
        }))
      );

      setLoading(false);
    } catch (err) {
      console.error("loadAnalytics error:", err);
      setLoading(false);
    }
  }, [selectedCategory, selectedZone, dateRange, searchTerm]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

useEffect(() => {
  const channel = supabase
    .channel("realtime-businesses")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "businesses" },
      () => loadAnalytics()
    )
    .subscribe();

  return () => {
    // cleanup must NOT be async in React
    supabase.removeChannel(channel);
  };
}, [loadAnalytics]);


  /* ---------------------- Derived Metrics ---------------------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading analytics…
      </div>
    );
  }

  const totalBusinesses = businesses.length;
  const totalCategories = categories.length;
  const avgPerCategory =
    totalCategories > 0 ? (totalBusinesses / totalCategories).toFixed(1) : "0";

  const zoneData = zones.map((z) => ({ name: z.zone_type, value: z.count }));
  const ZONE_COLORS = ["#3B82F6", "#EF4444", "#F59E0B", "#10B981"];

  /* ---------------------- Render ---------------------- */
  return (
    <div className="relative">

      {/* Everything inside this wrapper will appear in the PDF */}
      <div id="analytics-report" className="space-y-6">

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Refine analytics by business name, category, zone, and date
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <label className="font-medium text-sm">Search</label>
                <input
                  type="text"
                  placeholder="Search by business name or street"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full border p-2 rounded mt-1 text-sm"
                />
              </div>

              <div>
                <label className="font-medium text-sm">Category</label>
                <select
                  className="w-full border p-2 rounded mt-1 text-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="all">All</option>
                  {categories.map((c) => (
                    <option key={c.category} value={c.category}>
                      {c.category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-sm">Zone Type</label>
                <select
                  className="w-full border p-2 rounded mt-1 text-sm"
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                >
                  <option value="all">All</option>
                  {zones.map((z) => (
                    <option key={z.zone_type} value={z.zone_type}>
                      {z.zone_type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-sm">Date Range</label>
                <select
                  className="w-full border p-2 rounded mt-1 text-sm"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                >
                  <option value="all">All Time</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="1y">Last Year</option>
                </select>
              </div>
            </div>

            {/* Export + Refresh Section */}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={exportFullCSV}
                className="px-4 py-2 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                ⬇ Export CSV
              </button>

              <button
                onClick={exportFullPDF}
                className="px-4 py-2 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700"
              >
                📄 Export PDF
              </button>

              <button
                onClick={loadAnalytics}
                className="px-4 py-2 text-sm rounded bg-black text-white hover:bg-gray-800"
              >
                🔄 Refresh
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Total Businesses</CardTitle>
              <CardDescription>Registered businesses in area</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{totalBusinesses}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Business Categories</CardTitle>
              <CardDescription>Unique business types</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{totalCategories}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Avg. per Category</CardTitle>
              <CardDescription>Business density</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{avgPerCategory}</p>
            </CardContent>
          </Card>
        </div>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Business Distribution by Category</CardTitle>
            <CardDescription>
              Number of businesses in each category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={categories}>
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#4F46E5" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Zone Types */}
        <Card>
          <CardHeader>
            <CardTitle>Zone Type Distribution</CardTitle>
            <CardDescription>Commercial vs Residential zones</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ResponsiveContainer width="60%" height={300}>
              <PieChart>
                <Pie
                  data={zoneData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={120}
                  label
                >
                  {zoneData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={ZONE_COLORS[i % ZONE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Streets */}
        <Card>
          <CardHeader>
            <CardTitle>Top Business Locations</CardTitle>
            <CardDescription>
              Streets with highest business concentration
            </CardDescription>
          </CardHeader>
          <CardContent>
            {streets.map((s) => (
              <div
                key={s.street}
                className="flex items-center justify-between border-b py-2"
              >
                <span>{s.street}</span>
                <span className="font-semibold">{s.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Cluster Scatter Plot */}
        <Card>
          <CardHeader>
            <CardTitle>Cluster Centroids Geographic Distribution</CardTitle>
            <CardDescription>
              Based on business locations
            </CardDescription>
          </CardHeader>

          <CardContent>
            {clusterCentroids.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No cluster data available for current filters.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <XAxis type="number" dataKey="longitude" name="Longitude" tick={{ fontSize: 12 }} />
                  <YAxis type="number" dataKey="latitude" name="Latitude" tick={{ fontSize: 12 }} />

                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    formatter={(value, name) => {
                      if (name === "density") return [`${value}`, "Businesses in Cluster"];
                      if (name === "cluster_id") return [`Cluster ${value}`, "Cluster ID"];
                      return [value, name];
                    }}
                  />

                  {clusterCentroids.map((cluster, index) => (
                    <Scatter
                      key={index}
                      name={`Cluster ${cluster.cluster_id}`}
                      data={[cluster]}
                      fill={cluster.color}
                      stroke={cluster.color}
                      shape="circle"
                      radius={cluster.density * 3}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
