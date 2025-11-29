import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Activity,
  Users,
  BarChart3,
  Database,
  LogIn,
  Clock,
  RefreshCw,
  Search,
} from "lucide-react";

import { supabase } from "../../lib/supabase"; // ✅ New Supabase client

// ❌ Removed props interface — no props are required anymore

interface ActivityLog {
  id: number;
  action: string;
  status?: "success" | "error" | "info";
  user_email?: string;
  context?: string;
  details?: string;
  created_at?: string;
}

export function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | "success" | "error" | "info">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // ✅ NEW: Fetch from Supabase instead of API-client
  const fetchLogs = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error) {
        setLogs(data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []); // ❌ Removed accessToken dependency

  // Filters & search logic (UNCHANGED)
  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => (typeFilter === "all" ? true : log.status === typeFilter))
      .filter((log) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          (log.action ?? "").toLowerCase().includes(q) ||
          (log.details ?? "").toLowerCase().includes(q) ||
          (log.context ?? "").toLowerCase().includes(q) ||
          (log.user_email ?? "").toLowerCase().includes(q)
        );
      });
  }, [logs, typeFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Activity className="h-5 w-5 text-purple-600" />
            Activity Logs
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track sign-ins, clustering requests, and admin actions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-purple-100">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-sm">Filters</CardTitle>
              <CardDescription>Filter logs by type and keyword.</CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full min-w-[220px] md:w-72">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by action, user, or details"
                  className="pl-8 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Select
                value={typeFilter}
                onValueChange={(value: "all" | "success" | "error" | "info") =>
                  setTypeFilter(value)
                }
              >
                <SelectTrigger className="w-[140px] text-sm">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          <ScrollArea className="h-[420px] pr-3">
            <div className="space-y-2">
              {filteredLogs.map((log) => {
                let icon = <Activity className="h-3.5 w-3.5 text-slate-500" />;
                let badgeClass =
                  "border-slate-200 bg-slate-50 text-[10px] text-slate-700";

                if (log.status === "success") {
                  icon = <LogIn className="h-3.5 w-3.5 text-green-600" />;
                  badgeClass =
                    "border-green-200 bg-green-50 text-[10px] text-green-700";
                } else if (log.status === "error") {
                  icon = <BarChart3 className="h-3.5 w-3.5 text-red-600" />;
                  badgeClass =
                    "border-red-200 bg-red-50 text-[10px] text-red-700";
                } else if (log.status === "info") {
                  icon = <Database className="h-3.5 w-3.5 text-purple-600" />;
                  badgeClass =
                    "border-purple-200 bg-purple-50 text-[10px] text-purple-700";
                }

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 rounded-lg border border-purple-50 bg-white px-3 py-2 text-xs shadow-[0_1px_0_0_rgba(15,23,42,0.03)]"
                  >
                    <div className="mt-0.5">{icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {log.action || "Action"}
                          </span>
                          <Badge variant="outline" className={badgeClass}>
                            {log.status ?? "info"}
                          </Badge>
                        </div>

                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {log.created_at
                            ? new Date(log.created_at).toLocaleString()
                            : "—"}
                        </span>
                      </div>

                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {log.details || log.context || "No additional details"}
                      </p>

                      {log.user_email && (
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          User: <span className="font-medium">{log.user_email}</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {!loading && filteredLogs.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No logs match this filter.
                </p>
              )}

              {loading && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Loading activity logs...
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
