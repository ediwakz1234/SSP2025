import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import {
  Select,
  SelectTrigger,
  SelectItem,
  SelectValue,
  SelectContent,
} from "../ui/select";

import {
  Activity,
  LogIn,
  BarChart3,
  Database,
  Clock,
  Search,
  RefreshCcw,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

// ---------------- TYPES ----------------
interface ActivityLog {
  id: number;
  action: string;
  status?: string;
  user_id?: string | null;
  user_email?: string | null;
  details?: string | null;
  context?: Record<string, unknown> | null;
  created_at: string;
}

// Helper to safely parse context
const parseContext = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === "object" && value !== null) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return { raw: value };
    }
  }
  return { value };
};

export function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // ---------------- FETCH LOGS ----------------
  const fetchLogs = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading logs:", error);
      setLogs([]);
    } else {
      const normalized: ActivityLog[] = (data || []).map((row) => ({
        ...row,
        context: parseContext(row.context),
      }));
      setLogs(normalized);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // 🔥 Real-time listener
  useEffect(() => {
    const channel = supabase
      .channel("realtime_activity_logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_logs" },
        (payload) => {
          const newRow = payload.new as ActivityLog;
          setLogs((prev) => [
            { ...newRow, context: parseContext(newRow.context) },
            ...prev,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel); // synchronous cleanup
    };
  }, []);

  // ---------------- FILTERING & SEARCH ----------------
  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) =>
        actionFilter === "all" ? true : log.action === actionFilter
      )
      .filter((log) => {
        const q = searchQuery.toLowerCase();
        return (
          log.action.toLowerCase().includes(q) ||
          (log.user_email || "").toLowerCase().includes(q) ||
          (log.user_id || "").toLowerCase().includes(q) ||
          (log.details || "").toLowerCase().includes(q) ||
          JSON.stringify(log.context || {})
            .toLowerCase()
            .includes(q)
        );
      });
  }, [logs, actionFilter, searchQuery]);

  // ---------------- STATS ----------------
  const totalActivities = logs.length;
  const loginCount = logs.filter((l) => l.action === "user_login").length;
  const analysisCount = logs.filter(
    (l) => l.action === "clustering_analysis"
  ).length;
  const dataChanges = logs.filter((l) =>
    ["seed_data_reset", "seed_data_updated"].includes(l.action)
  ).length;

  // ---------------- HELPERS ----------------
  const getIcon = (action: string) => {
    if (action === "user_login") return <LogIn className="text-blue-600" />;
    if (action === "clustering_analysis")
      return <BarChart3 className="text-purple-600" />;
    if (action.includes("seed_data"))
      return <Database className="text-orange-500" />;
    return <Activity className="text-gray-400" />;
  };

  const formatAction = (action: string) => {
    const map: Record<string, string> = {
      user_login: "User Login",
      clustering_analysis: "Clustering Analysis",
      seed_data_reset: "Seed Reset",
      seed_data_updated: "Seed Update",
    };
    return map[action] || action.replace(/_/g, " ");
  };

  // ---------------- RENDER ----------------
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-linear-to-r from-purple-500 via-violet-500 to-indigo-500 opacity-20 blur-2xl animate-pulse"></div>
          <div className="relative flex flex-col items-center gap-4">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full bg-linear-to-r from-purple-500 to-violet-500 animate-spin" style={{ clipPath: 'polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%)' }}></div>
              <div className="absolute inset-1 rounded-full bg-white"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-gray-600">Loading activity logs...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-purple-600 via-violet-600 to-indigo-700 p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-purple-400/20 blur-2xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Activity className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Activity Logs</h1>
              <p className="text-purple-100 mt-1">Monitor all system activities in real-time</p>
            </div>
          </div>
          <Button
            onClick={fetchLogs}
            variant="outline"
            className="bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur-sm transition-all duration-300 hover:scale-105"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* HEADER COUNTERS */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <Card className="group relative overflow-hidden border-0 bg-linear-to-br from-blue-50 to-indigo-50 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl group-hover:bg-blue-500/20 transition-colors duration-500"></div>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-indigo-500">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <CardTitle className="text-sm font-medium text-gray-600">Total Activities</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{totalActivities}</div>
            <p className="text-xs text-muted-foreground mt-1">Logged actions</p>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-0 bg-linear-to-br from-green-50 to-emerald-50 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-green-500/10 blur-2xl group-hover:bg-green-500/20 transition-colors duration-500"></div>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-green-500 to-emerald-500">
                <LogIn className="h-4 w-4 text-white" />
              </div>
              <CardTitle className="text-sm font-medium text-gray-600">User Logins</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-linear-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{loginCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Authentication events</p>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-0 bg-linear-to-br from-purple-50 to-violet-50 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl group-hover:bg-purple-500/20 transition-colors duration-500"></div>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-purple-500 to-violet-500">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              <CardTitle className="text-sm font-medium text-gray-600">Analyses</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-linear-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">{analysisCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Clustering operations</p>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden border-0 bg-linear-to-br from-orange-50 to-amber-50 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl group-hover:bg-orange-500/20 transition-colors duration-500"></div>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-orange-500 to-amber-500">
                <Database className="h-4 w-4 text-white" />
              </div>
              <CardTitle className="text-sm font-medium text-gray-600">Data Changes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-linear-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">{dataChanges}</div>
            <p className="text-xs text-muted-foreground mt-1">Seed data updates</p>
          </CardContent>
        </Card>
      </div>

      {/* MAIN CARD */}
      <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-linear-to-r from-gray-50 to-slate-50 border-b">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-purple-500 to-violet-500">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Recent Activities</CardTitle>
              <CardDescription>
                Showing <span className="font-medium text-purple-600">{filteredLogs.length}</span> of <span className="font-medium">{logs.length}</span> activities
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {/* Search & Filter Row */}
        <div className="flex items-center gap-4 p-5 bg-gray-50/50 border-b">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              className="pl-10 bg-white border-gray-200 focus:border-purple-400 focus:ring-purple-400/20 rounded-xl transition-all duration-300"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[200px] bg-white border-gray-200 rounded-xl hover:border-purple-400 transition-colors duration-300">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Actions</SelectItem>
              {Array.from(new Set(logs.map((l) => l.action))).map((action) => (
                <SelectItem key={action} value={action}>
                  {formatAction(action)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* LOG LIST */}
        <ScrollArea className="h-[600px]">
          <div className="p-5 space-y-4">
            {filteredLogs.map((log, index) => (
              <div
                key={log.id}
                className="group relative w-full space-y-3 rounded-xl border bg-linear-to-br from-white to-gray-50/50 p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="absolute top-0 left-0 h-full w-1 rounded-l-xl bg-linear-to-b from-purple-500 via-violet-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-gray-100 to-gray-50 border shadow-sm group-hover:scale-105 transition-transform duration-300">
                    {getIcon(log.action)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800">
                        {formatAction(log.action)}
                      </p>
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200">
                        {log.action}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(log.created_at).toLocaleString()}
                      </span>

                      {log.user_email && (
                        <span className="flex items-center gap-1">
                          <span className="text-gray-400">•</span>
                          <span className="font-medium text-gray-600">{log.user_email}</span>
                        </span>
                      )}
                    </div>

                    {log.user_id && (
                      <p className="text-xs text-muted-foreground mt-1">
                        User ID: <span className="font-mono text-gray-600">{log.user_id}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Simple details text */}
                {log.details && (
                  <div className="rounded-xl border bg-linear-to-r from-blue-50/50 to-indigo-50/50 p-4 text-sm text-gray-700">
                    <p>{log.details}</p>
                  </div>
                )}

                {/* Context metadata (e.g. num_clusters, business_type, etc.) */}
                {log.context && Object.keys(log.context).length > 0 && (
                  <div className="rounded-xl border bg-linear-to-r from-purple-50/50 to-violet-50/50 p-4 text-sm">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.entries(log.context).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            {key.replace(/_/g, ' ')}:
                          </span>
                          <span className="text-sm font-medium text-gray-800">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {filteredLogs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-gray-100 to-gray-50 mb-4">
                  <Activity className="h-10 w-10 text-gray-400" />
                </div>
                <p className="text-lg font-medium text-gray-600">No activities found</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filter</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
