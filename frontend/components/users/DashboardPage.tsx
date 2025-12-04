import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "../ui/card";

import {
  Loader2,
  LayoutDashboard,
  Store,
  Users,
  MapPin,
  TrendingUp,
  Building2,
  Briefcase,
  BarChart3,
  GitBranch,
  Map as MapIcon,
  Activity as ActivityIcon,
  Download,
  LogIn,
  Clock,
  Sparkles,
  ArrowUpRight,
  Trophy
} from "lucide-react";

import { LOCATION_INFO } from "../../data/businesses";
import { supabase } from "../../lib/supabase";
import BusinessMap from "../auth/BusinessMaps";
import { LucideIcon } from "lucide-react";
import { useActivity, logActivity } from "../../utils/activity";

// -------------------------------
// TYPES
// -------------------------------
type Business = {
  business_id?: number;
  business_name?: string;
  general_category?: string;
  type?: string;
  street: string;
  zone_type?: string;
  latitude: number;
  longitude: number;
  competitor_density_50m?: number;
  competitor_density_100m?: number;
  competitor_density_200m?: number;
  business_density_50m?: number;
  business_density_100m?: number;
  business_density_200m?: number;
};

type ActivityLog = {
  id: number;
  action: string;
  created_at?: string;
  metadata?: {
    page?: string;
    timeSpentSeconds?: number;
    [key: string]: unknown;
  } | null;
};

type PageType = "clustering" | "analytics" | "map" | "opportunities";

type LightActionProps = {
  icon: LucideIcon;
  title: string;
  desc: string;
  action: PageType;
};

// ------------------------------------------------
// Utility Functions
// ------------------------------------------------

// Clean action text
function cleanAction(action: string) {
  if (!action) return "";
  return action
    .replace(/^Opened\s*/i, "")
    .replace(/^Clicked\s*/i, "")
    .replace(/_/g, " ")
    .trim();
}

// Days difference
function daysDiff(dateString?: string) {
  if (!dateString) return 9999;
  const date = new Date(dateString);
  const now = new Date();
  const diff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  return Math.floor(diff);
}

function getActionIcon(action: string) {
  const a = action.toLowerCase();

  if (a.includes("dashboard")) return LayoutDashboard;
  if (a.includes("clustering")) return GitBranch;
  if (a.includes("analytic")) return BarChart3;
  if (a.includes("map")) return MapIcon;
  if (a.includes("opportunit")) return TrendingUp;
  if (a.includes("export")) return Download;
  if (a.includes("login")) return LogIn;

  return ActivityIcon;
}


// ------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------
export function DashboardPage() {
  useActivity(); // Auto-page logging
  

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Load user info
  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (user) {
        const meta = user.user_metadata;
        const fullname =
          `${meta.first_name || ""} ${meta.last_name || ""}`.trim() ||
          user.email ||
          null;
        setUserName(fullname);
      }
    };

    loadUser();
  }, []);

  // Load businesses + logs
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const { data: biz, error: bizError } = await supabase.from("businesses").select("*");
        if (bizError) {
          toast.error("Failed to load businesses");
          console.error("Business load error:", bizError);
        }
        setBusinesses(biz || []);

        const { data: logs, error: logsError } = await supabase
          .from("activity_logs")
          .select("id, action, created_at, metadata")
          .order("created_at", { ascending: false })
          .limit(40);

        if (logsError) {
          console.error("Activity logs error:", logsError);
        }
        setActivityLogs(logs || []);
      } catch (err) {
        toast.error("Error loading dashboard data");
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // CATEGORY NORMALIZATION
  const normalizeCategory = (category: string) => {
    if (!category) return "Unknown";
    const c = category.trim().toLowerCase();
    if (c.includes("merch")) return "Merchandise / Trading";
    if (c.includes("food")) return "Food & Beverage";
    if (c.includes("rest")) return "Restaurant";
    if (c.includes("service")) return "Services";
    if (c.includes("retail")) return "Retail";
    if (c.includes("entertain")) return "Entertainment / Leisure";
    return category.trim();
  };

  // CATEGORY COUNTS
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    businesses.forEach((b) => {
      const clean = normalizeCategory(b.general_category || b.type || "Unknown");
      map.set(clean, (map.get(clean) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([general_category, count]) => ({ general_category, count }))
      .sort((a, b) => b.count - a.count);
  }, [businesses]);

  // LOW COMPETITION
  const lowCompetition = useMemo(() => {
    const stats = new Map<string, { total: number; low: number }>();

    businesses.forEach((b) => {
      const cat = normalizeCategory(b.general_category || "");
      const isLow =
        (b.competitor_density_200m ?? 0) <= 2 &&
        (b.competitor_density_100m ?? 0) <= 1;

      const entry = stats.get(cat) || { total: 0, low: 0 };
      entry.total++;
      if (isLow) entry.low++;
      stats.set(cat, entry);
    });

    return Array.from(stats.entries())
      .filter(([, s]) => s.low >= 3)
      .map(([category, s]) => ({ category, score: s.low }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [businesses]);

  // Stats
  const stats = [
    { title: "Total Businesses", value: businesses.length, icon: Store },
    { title: "Business Categories", value: categoryCounts.length, icon: Briefcase },
    { title: "Commercial Zones", value: businesses.filter((b) => b.zone_type === "Commercial").length, icon: Building2 },
    { title: "Residential Zones", value: businesses.filter((b) => b.zone_type === "Residential").length, icon: MapPin },
    { title: "Growth Potential", value: "High", icon: TrendingUp },
  ];

  // ------------------------------------------------
  // LOADING SCREEN
  // ------------------------------------------------
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] animate-fadeIn">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 animate-pulse flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <div className="absolute -inset-4 bg-linear-to-br from-indigo-500/20 to-purple-600/20 rounded-3xl blur-xl animate-pulse" />
        </div>
        <p className="mt-6 text-gray-600 font-medium">Loading dashboard...</p>
        <p className="text-sm text-gray-400 mt-1">Preparing your insights</p>
      </div>
    );
  }

  // ------------------------------------------------
  // RENDER
  // ------------------------------------------------
  return (
    <div className="page-wrapper space-y-8">

      {/* Hero Greeting Section */}
      <div className="page-content relative overflow-hidden rounded-2xl bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 text-white">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            <span className="text-sm font-medium text-white/80">Dashboard Overview</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {userName || "User"} 👋
          </h1>
          <p className="text-white/80">
            Here's what's happening with your business landscape analysis today.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stagger-children grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const colors = [
            { bg: "from-indigo-500 to-indigo-600", light: "bg-indigo-50", text: "text-indigo-600" },
            { bg: "from-purple-500 to-purple-600", light: "bg-purple-50", text: "text-purple-600" },
            { bg: "from-blue-500 to-blue-600", light: "bg-blue-50", text: "text-blue-600" },
            { bg: "from-emerald-500 to-emerald-600", light: "bg-emerald-50", text: "text-emerald-600" },
            { bg: "from-amber-500 to-amber-600", light: "bg-amber-50", text: "text-amber-600" },
          ];
          const color = colors[index % colors.length];
          
          return (
            <div 
              key={stat.title} 
              className="stat-card-modern group"
              style={{ "--stat-color": index === 0 ? "#6366f1" : index === 1 ? "#a855f7" : index === 2 ? "#3b82f6" : index === 3 ? "#10b981" : "#f59e0b" } as React.CSSProperties}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 ${color.light} rounded-xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                  <Icon className={`w-6 h-6 ${color.text}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Layout */}
      <div className="grid gap-8 lg:grid-cols-3">

        {/* LEFT SIDE */}
        <div className="space-y-6 lg:col-span-2">

          {/* Overview */}
          <Card className="overflow-hidden border-0 shadow-card hover:shadow-card-hover transition-shadow duration-300">
            <CardHeader className="bg-linear-to-r from-gray-50 to-white border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <CardTitle className="text-lg">Business Landscape Overview</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <Info label="Barangay" value={LOCATION_INFO.barangay} icon={<MapPin className="w-4 h-4 text-indigo-500" />} />
                <Info label="Municipality" value={LOCATION_INFO.municipality} icon={<Building2 className="w-4 h-4 text-purple-500" />} />
                <Info label="Province" value={LOCATION_INFO.province} icon={<MapPin className="w-4 h-4 text-blue-500" />} />
                <Info label="Postal Code" value={LOCATION_INFO.postal_code} icon={<Store className="w-4 h-4 text-emerald-500" />} />
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-medium text-gray-700">Location Coordinates</span>
                </div>
                <p className="text-lg font-mono text-gray-600">
                  {LOCATION_INFO.center_latitude.toFixed(4)}°N, {LOCATION_INFO.center_longitude.toFixed(4)}°E
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Categories */}
          <Card className="overflow-hidden border-0 shadow-card hover:shadow-card-hover transition-shadow duration-300">
            <CardHeader className="bg-linear-to-r from-gray-50 to-white border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <CardTitle className="text-lg">Business Distribution by Category</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {categoryCounts.map((item, index) => (
                <CategoryBar
                  key={item.general_category}
                  rank={index + 1}
                  category={item.general_category}
                  count={item.count}
                  total={businesses.length}
                />
              ))}
            </CardContent>
          </Card>

          {/* Low competition */}
          <Card className="overflow-hidden border-0 shadow-card hover:shadow-card-hover transition-shadow duration-300">
            <CardHeader className="bg-linear-to-r from-gray-50 to-white border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <CardTitle className="text-lg">Top 5 Low-Competition Categories</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              {lowCompetition.length > 0 ? (
                lowCompetition.map((lc, index) => (
                  <div
                    key={lc.category}
                    className="flex items-center justify-between p-4 rounded-xl bg-linear-to-r from-gray-50 to-white border border-gray-100 hover:border-emerald-200 hover:shadow-sm transition-all duration-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white ${
                        index === 0 ? "bg-linear-to-br from-yellow-400 to-orange-500" :
                        index === 1 ? "bg-linear-to-br from-gray-400 to-gray-500" :
                        index === 2 ? "bg-linear-to-br from-amber-600 to-amber-700" :
                        "bg-linear-to-br from-gray-300 to-gray-400"
                      }`}>
                        {index + 1}
                      </div>
                      <span className="font-medium text-gray-800">{lc.category}</span>
                    </div>
                    <span className="badge-modern badge-success">
                      {lc.score} spots
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No low-competition data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Next actions */}
          <Card className="overflow-hidden border-0 shadow-card">
            <CardHeader className="bg-linear-to-r from-gray-50 to-white border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <LightAction
                  icon={GitBranch}
                  title="Run K-Means Analysis"
                  desc="Analyze optimal business locations"
                  action="clustering"
                />
                <LightAction
                  icon={BarChart3}
                  title="View Analytics"
                  desc="Detailed insights & graphs"
                  action="analytics"
                />
                <LightAction
                  icon={MapIcon}
                  title="Interactive Map"
                  desc="Visualize business data"
                  action="map"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT SIDE */}
        <div className="space-y-6">

          {/* Map */}
          <Card className="overflow-hidden border-0 shadow-card hover:shadow-card-hover transition-shadow duration-300">
            <CardHeader className="bg-linear-to-r from-gray-50 to-white border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <MapIcon className="w-5 h-5 text-white" />
                </div>
                <CardTitle className="text-lg">Location Map</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[280px]">
                <BusinessMap />
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="overflow-hidden border-0 shadow-card hover:shadow-card-hover transition-shadow duration-300">
            <CardHeader className="bg-linear-to-r from-gray-50 to-white border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <CardTitle className="text-lg">Location Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <Summary icon={Store} text={`${businesses.length} registered businesses`} color="indigo" />
              <Summary icon={Users} text="Growing population" color="purple" />
              <Summary icon={Building2} text="Commercial-residential mix" color="blue" />
              <Summary icon={TrendingUp} text="Strong potential" color="emerald" />
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="overflow-hidden border-0 shadow-card flex-1">
            <CardHeader className="bg-linear-to-r from-gray-50 to-white border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-linear-to-br from-orange-500 to-red-500 flex items-center justify-center">
                    <ActivityIcon className="w-5 h-5 text-white" />
                  </div>
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                </div>
              </div>
            </CardHeader>

            {/* Search + Filter */}
            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center gap-3">
              <input
                type="text"
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
              />

              {/* Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all cursor-pointer"
              >
                <option value="all">All Time</option>
                <option value="yesterday">Yesterday</option>
                <option value="3days">Last 3 Days</option>
                <option value="week">This Week</option>
              </select>
            </div>

            <CardContent className="p-0 max-h-80 overflow-y-auto scrollbar-thin">
              <div className="p-4 space-y-2">
              {(() => {
                let logs = activityLogs.filter((log) => {
                  const diff = daysDiff(log.created_at);

                  if (filterType === "yesterday") return diff <= 2 && diff > 1;
                  if (filterType === "3days") return diff <= 3;
                  if (filterType === "week") return diff <= 7;
                  return true;
                });

                if (searchQuery.trim() !== "") {
                  const q = searchQuery.toLowerCase();
                  logs = logs.filter((log) =>
                    log.action.toLowerCase().includes(q) ||
                    (log.metadata?.page || "").toLowerCase().includes(q)
                  );
                }

                if (logs.length === 0)
                  return (
                    <div className="text-center py-12">
                      <ActivityIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">No activity found.</p>
                    </div>
                  );

                  

                return logs.map((log) => {
  const Icon = getActionIcon(log.action);

  return (
    <div
      key={log.id}
      className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
          <Icon className="w-4 h-4 text-gray-500 group-hover:text-indigo-500 transition-colors" />
        </div>

        <div className="flex flex-col">
          <p className="font-medium text-sm text-gray-800">{cleanAction(log.action)}</p>

          {log.metadata?.timeSpentSeconds != null && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {log.metadata.timeSpentSeconds}s spent
            </p>
          )}
        </div>
      </div>

      <span className="text-xs text-gray-400 font-medium">
        {new Date(log.created_at!).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })}
      </span>
    </div>
  );
});

              })()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}// ------------------------------------------------
// Helper Components
// ------------------------------------------------
function Info({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/50">
      {icon && <div className="mt-0.5">{icon}</div>}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-gray-800 font-semibold mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function CategoryBar({
  rank,
  category,
  count,
  total
}: {
  rank: number;
  category: string;
  count: number;
  total: number;
}) {
  const percentage = total ? (count / total) * 100 : 0;
  const colors = [
    "from-indigo-500 to-purple-500",
    "from-blue-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
    "from-pink-500 to-rose-500",
    "from-violet-500 to-purple-500",
  ];
  
  return (
    <div className="group">
      <div className="flex items-center gap-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white bg-linear-to-br ${colors[rank % colors.length]}`}>
          {rank}
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-gray-800">{category}</span>
            <span className="text-sm text-gray-500">{count} businesses</span>
          </div>

          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full bg-linear-to-r ${colors[rank % colors.length]} transition-all duration-500 group-hover:opacity-80`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Summary({ icon: Icon, text, color = "gray" }: { icon: LucideIcon; text: string; color?: string }) {
  const colorClasses: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600",
    purple: "bg-purple-50 text-purple-600",
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    gray: "bg-gray-100 text-gray-600",
  };
  
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm font-medium text-gray-700">{text}</span>
    </div>
  );
}

// ------------------------------------------------
// Quick Action Button
// ------------------------------------------------
export function LightAction({
  icon: Icon,
  title,
  desc,
  action
}: LightActionProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => {
        logActivity(`Clicked ${title}`, { page: action });
        navigate(`/user/${action}`);
      }}
      className="group relative p-5 rounded-2xl bg-white border border-gray-100 hover:border-indigo-200 transition-all duration-300 text-left hover:shadow-lg hover:-translate-y-1"
    >
      <div className="absolute inset-0 bg-linear-to-br from-indigo-500/5 to-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative">
        <div className="w-12 h-12 rounded-xl bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <Icon className="w-6 h-6 text-white" />
        </div>
        <p className="font-semibold text-gray-800 mb-1 group-hover:text-indigo-600 transition-colors">{title}</p>
        <p className="text-sm text-gray-500">{desc}</p>
        
        <div className="mt-3 flex items-center text-indigo-500 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          <span>Get started</span>
          <ArrowUpRight className="w-4 h-4 ml-1" />
        </div>
      </div>
    </button>
  );
}
