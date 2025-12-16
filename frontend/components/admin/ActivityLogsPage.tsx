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
  Eye,
  Calendar,
  Download,
  Filter,
  Inbox,
  User,
  Shield,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import { ActivityLogDetailsModal } from "./ActivityLogDetailsModal";

// ---------------- TYPES ----------------
interface ActivityLog {
  id: number;
  action: string;
  status?: string;
  user_id?: string | null;
  user_email?: string | null;
  details?: string | null;
  context?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
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

// Get today's date in YYYY-MM-DD format (local timezone)
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Convert UTC timestamp to local date string YYYY-MM-DD
const getLocalDate = (utcTimestamp: string) => {
  const date = new Date(utcTimestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<"today" | "all" | "week">("today"); // Default to today

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
        metadata: parseContext(row.metadata),
      }));
      setLogs(normalized);
    }

    setLoading(false);
  };

  const handleViewDetails = (log: ActivityLog) => {
    setSelectedLog(log);
    setModalOpen(true);
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
    const today = getTodayDate();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoDate = getLocalDate(weekAgo.toISOString());

    return logs
      // Date filter (using local timezone)
      .filter((log) => {
        if (dateFilter === "all") return true;
        const logDate = getLocalDate(log.created_at);
        if (dateFilter === "today") return logDate === today;
        if (dateFilter === "week") return logDate >= weekAgoDate;
        return true;
      })
      // Action filter
      .filter((log) =>
        actionFilter === "all" ? true : log.action === actionFilter
      )
      // Search filter
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
  }, [logs, actionFilter, searchQuery, dateFilter]);

  // ---------------- STATS ----------------
  // Daily stats - only count today's logs (using local timezone)
  const today = getTodayDate();
  const todayLogs = logs.filter(log => getLocalDate(log.created_at) === today);

  const todayActivities = todayLogs.length;
  const todayLogins = todayLogs.filter((l) =>
    l.action === "user_login" ||
    l.action.toLowerCase().includes("login")
  ).length;

  // Cumulative stats - count ALL logs (not filtered by date)
  // Total Analyses Run: clustering_analysis, Ran Clustering, etc.
  const totalAnalysesRun = logs.filter((l) =>
    l.action === "clustering_analysis" ||
    l.action.toLowerCase().includes("ran clustering") ||
    l.action.toLowerCase().includes("clustering analysis") ||
    l.action.toLowerCase().includes("analysis")
  ).length;

  // Admin Seed Data Changes: all seed data modifications
  const adminSeedDataChanges = logs.filter((l) =>
    l.action === "seed_data_reset" ||
    l.action === "seed_data_updated" ||
    l.action === "seed_data_added" ||
    l.action === "seed_data_deleted" ||
    l.action.toLowerCase().includes("seed") ||
    l.action.toLowerCase().includes("business added") ||
    l.action.toLowerCase().includes("business updated") ||
    l.action.toLowerCase().includes("business deleted")
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
      <div className="relative overflow-hidden rounded-2xl bg-slate-700 p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/10 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-slate-400/20 blur-2xl translate-y-1/2 -translate-x-1/2"></div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Activity className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Activity Logs</h1>
              <p className="text-slate-200 mt-1">Monitor all system activities in real-time</p>
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
        {/* Today's Activities - Daily Reset */}
        <Card className="group relative overflow-hidden border-0 bg-linear-to-br from-blue-50 to-indigo-50 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl group-hover:bg-blue-500/20 transition-colors duration-500"></div>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-indigo-500">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <CardTitle className="text-sm font-medium text-gray-600">
                Today's Activities
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{todayActivities}</div>
            <p className="text-xs text-muted-foreground mt-1">
              System actions logged today
            </p>
          </CardContent>
        </Card>

        {/* Today's Logins - Daily Reset */}
        <Card className="group relative overflow-hidden border-0 bg-linear-to-br from-green-50 to-emerald-50 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-green-500/10 blur-2xl group-hover:bg-green-500/20 transition-colors duration-500"></div>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-green-500 to-emerald-500">
                <LogIn className="h-4 w-4 text-white" />
              </div>
              <CardTitle className="text-sm font-medium text-gray-600">
                Today's Logins
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-linear-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{todayLogins}</div>
            <p className="text-xs text-muted-foreground mt-1">
              User sign-ins recorded today
            </p>
          </CardContent>
        </Card>

        {/* Total Analyses Run - Cumulative */}
        <Card className="group relative overflow-hidden border-0 bg-linear-to-br from-purple-50 to-violet-50 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl group-hover:bg-purple-500/20 transition-colors duration-500"></div>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-purple-500 to-violet-500">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              <CardTitle className="text-sm font-medium text-gray-600">Total Analyses Run</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-linear-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">{totalAnalysesRun}</div>
            <p className="text-xs text-muted-foreground mt-1">All analytical operations executed</p>
          </CardContent>
        </Card>

        {/* Admin Seed Data Changes - Cumulative */}
        <Card className="group relative overflow-hidden border-0 bg-linear-to-br from-orange-50 to-amber-50 shadow-md hover:shadow-xl transition-all duration-500 hover:-translate-y-1">
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl group-hover:bg-orange-500/20 transition-colors duration-500"></div>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-orange-500 to-amber-500">
                <Database className="h-4 w-4 text-white" />
              </div>
              <CardTitle className="text-sm font-medium text-gray-600">Admin Seed Data Changes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold bg-linear-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">{adminSeedDataChanges}</div>
            <p className="text-xs text-muted-foreground mt-1">All seed data modifications by admins</p>
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
        <div className="flex flex-wrap items-center gap-4 p-5 bg-gray-50/50 border-b">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              className="pl-10 bg-white border-gray-200 focus:border-purple-400 focus:ring-purple-400/20 rounded-xl transition-all duration-300"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Date Filter */}
          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as "today" | "all" | "week")}>
            <SelectTrigger className="w-[140px] bg-white border-gray-200 rounded-xl hover:border-purple-400 transition-colors duration-300">
              <Calendar className="w-4 h-4 mr-2 text-gray-400" />
              <SelectValue placeholder="Today" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          {/* Action Filter */}
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px] bg-white border-gray-200 rounded-xl hover:border-purple-400 transition-colors duration-300">
              <Filter className="w-4 h-4 mr-2 text-gray-400" />
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

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={fetchLogs}
            className="rounded-xl hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600 transition-all"
          >
            <RefreshCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* LOG LIST */}
        <ScrollArea className="h-[600px]">
          <div className="p-5 space-y-4">
            {/* Empty State */}
            {filteredLogs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center mb-6">
                  <Inbox className="w-10 h-10 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {dateFilter === "today" ? "No Logs Yet Today" :
                    dateFilter === "week" ? "No Logs This Week" :
                      searchQuery ? "No Matching Logs" : "No Logs Found"}
                </h3>
                <p className="text-gray-500 max-w-sm mb-6">
                  {dateFilter === "today"
                    ? "Activity logs will appear here as users interact with the system."
                    : dateFilter === "week"
                      ? "No activity has been recorded in the past 7 days."
                      : searchQuery
                        ? "Try adjusting your search query or filters."
                        : "No activity has been logged yet."}
                </p>
                {dateFilter !== "all" && (
                  <Button
                    variant="outline"
                    onClick={() => setDateFilter("all")}
                    className="rounded-xl hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600"
                  >
                    View All Time Logs
                  </Button>
                )}
              </div>
            )}

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

                  {/* View Details Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-white hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200"
                    onClick={() => handleViewDetails(log)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View Details
                  </Button>
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

      {/* Activity Log Details Modal */}
      <ActivityLogDetailsModal
        log={selectedLog}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedLog(null);
        }}
      />
    </div>
  );
}
