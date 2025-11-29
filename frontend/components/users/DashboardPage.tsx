import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
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
  Loader2,
} from "lucide-react";
import { LOCATION_INFO } from "../../data/businesses";
import { supabase } from "../../lib/supabase";
import BusinessMap from "../auth/BusinessMaps";

type Business = {
  id?: number | string;
  business_id?: number;
  business_name?: string;
  name?: string;
  category?: string;
  type?: string;
  zone_type?: string;
  latitude: number;
  longitude: number;
};

type ActivityLog = {
  id: number | string;
  action: string;
  created_at?: string;
  user_email?: string;
  metadata?: any;
};

export function DashboardPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;

      const meta = user.user_metadata || {};
      const name =
        [meta.first_name, meta.last_name].filter(Boolean).join(" ") ||
        meta.username ||
        user.email ||
        null;

      if (name) setUserName(name);
    };

    loadUser();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: businessData, error: businessError } = await supabase
          .from("businesses")
          .select("*");

        if (businessError) throw businessError;
        setBusinesses(businessData || []);

        const { data: activityData, error: activityError } = await supabase
          .from("activity_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);

        if (activityError) throw activityError;
        setActivityLogs(activityData || []);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load dashboard data."
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          businesses
            .map((b) => b.category || b.type || "")
            .filter(Boolean)
        )
      ),
    [businesses]
  );

  const commercialZones = businesses.filter(
    (b) => b.zone_type === "Commercial"
  ).length;

  const residentialZones = businesses.filter(
    (b) => b.zone_type === "Residential"
  ).length;

  const totalBusinesses = businesses.length;

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of businesses) {
      const cat = (b.category || b.type || "Unknown") as string;
      map.set(cat, (map.get(cat) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [businesses]);

  const stats = [
    { title: "Total Businesses", value: totalBusinesses, icon: Store },
    { title: "Business Categories", value: categories.length, icon: Briefcase },
    { title: "Commercial Zones", value: commercialZones, icon: Building2 },
    { title: "Residential Zones", value: residentialZones, icon: MapPin },
    { title: "Growth Potential", value: "High", icon: TrendingUp },
  ];

  if (loading && businesses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-black">
        <Loader2 className="w-6 h-6 mb-2 animate-spin" />
        Loading dashboard data…
      </div>
    );
  }

  return (
    <div className="space-y-6 text-black min-h-screen">

      {/* Greeting */}
      <div className="space-y-1">
        {userName && (
          <p className="text-base font-semibold text-black">
            Welcome back, <span className="text-blue-600">{userName}</span> 👋
          </p>
        )}
        <p className="text-sm text-black">Data source: Supabase</p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-black">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="shadow-sm bg-white border border-gray-200">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-black">{stat.title}</p>
                  <p className="text-xl font-semibold text-black">{stat.value}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-black" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* GRID */}
      <div className="grid gap-6 lg:grid-cols-3 min-h-[600px]">

        {/* LEFT */}
        <div className="space-y-6 lg:col-span-2">

          {/* Overview */}
          <Card className="shadow-sm bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-black">Business Landscape Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-black">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Info label="Barangay" value={LOCATION_INFO.barangay} />
                <Info label="Municipality" value={LOCATION_INFO.municipality} />
                <Info label="Province" value={LOCATION_INFO.province} />
                <Info label="Postal Code" value={LOCATION_INFO.postal_code} />
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-black">Coordinates</p>
                <p className="text-black">
                  {LOCATION_INFO.center_latitude.toFixed(4)},{" "}
                  {LOCATION_INFO.center_longitude.toFixed(4)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Category Distribution */}
          <Card className="shadow-sm bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-black">Business Distribution by Category</CardTitle>
            </CardHeader>
            <CardContent className="text-black">
              {categoryCounts.length === 0 ? (
                <p className="text-sm">No business data yet.</p>
              ) : (
                <div className="space-y-3">
                  {categoryCounts.map((item, index) => (
                    <CategoryBar
                      key={item.category}
                      rank={index + 1}
                      category={item.category}
                      count={item.count}
                      total={totalBusinesses}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="shadow-sm bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-black">Next Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <LightAction icon={GitBranch} title="Run K-Means Analysis" desc="Analyze optimal business locations" action="clustering" />
              <LightAction icon={BarChart3} title="View Analytics" desc="Explore detailed charts and graphs" action="analytics" />
              <LightAction icon={MapIcon} title="Interactive Map" desc="Visualize business locations" action="map" />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="space-y-6 h-full">

          {/* Map */}
          <Card className="shadow-sm bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-black">Location Map</CardTitle>
            </CardHeader>
            <CardContent>
              <BusinessMap />
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="shadow-sm bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-black">Location Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-black">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 mt-1 text-black" />
                <div className="space-y-1 text-sm text-black">
                  <p className="font-medium">
                    {LOCATION_INFO.barangay}, {LOCATION_INFO.municipality}
                  </p>
                  <p className="text-black">{LOCATION_INFO.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Summary icon={Store} text={`${totalBusinesses} registered businesses`} />
                <Summary icon={Users} text="Growing customer base" />
                <Summary icon={Building2} text="Mixed commercial-residential zone" />
                <Summary icon={TrendingUp} text="Strong development potential" />
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="shadow-sm bg-white border border-gray-200">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-black">Recent Activity</CardTitle>
              <ActivityIcon className="w-4 h-4 text-black" />
            </CardHeader>
            <CardContent className="text-black">
              {activityLogs.length === 0 ? (
                <p className="text-sm">No recent activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="flex flex-col gap-1 border-b border-gray-200 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-black">{log.action}</p>
                          {log.user_email && <p className="text-xs text-black">{log.user_email}</p>}
                        </div>
                        {log.created_at && (
                          <span className="text-xs text-black">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
}

/* Helper Components */

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-sm text-black">{label}</p>
      <p className="text-black">{value}</p>
    </div>
  );
}

function CategoryBar({ rank, category, count, total }: { rank: number; category: string; count: number; total: number }) {
  return (
    <div className="flex items-center gap-3 text-black">
      <div className="w-8 text-center text-sm text-black">{rank}</div>
      <div className="flex-1 text-black">
        <div className="flex items-center justify-between mb-1">
          <span className="text-black">{category}</span>
          <span className="text-sm text-black">{count} businesses</span>
        </div>
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-black" style={{ width: `${(count / total) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function LightAction({ icon: Icon, title, desc, action }: { icon: any; title: string; desc: string; action: string }) {
  return (
    <button onClick={() => (window as any).navigateTo?.(action)} className="p-4 border border-gray-200 bg-white rounded-lg hover:bg-gray-100 cursor-pointer transition-colors text-left shadow-sm text-black">
      <Icon className="w-8 h-8 mb-2 text-black" />
      <h4 className="font-medium text-black">{title}</h4>
      <p className="text-sm text-black mt-1">{desc}</p>
    </button>
  );
}

function Summary({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-center gap-2 text-black">
      <Icon className="w-4 h-4 text-black" />
      <span className="text-black">{text}</span>
    </div>
  );
}
