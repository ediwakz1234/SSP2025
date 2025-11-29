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

import { Avatar, AvatarFallback } from "../ui/avatar";
import { toast } from "sonner";

import {
  Users,
  Search,
  RefreshCw,
  UserCheck,
  UserX,
  Calendar,
  Activity,
} from "lucide-react";

import { getAllUsers } from "../../lib/api-client";

interface SspUser {
  id: number;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  created_at?: string;
  gender?: string;
}

export function UserManagement() {
  // ⬅️ NEW: self-managed authentication
  const accessToken = localStorage.getItem("access_token") || "";

  const [users, setUsers] = useState<SspUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch Users
  const fetchUsers = async () => {
    if (!accessToken) {
      toast.error("Access token missing. Please log in again.");
      return;
    }

    try {
      setLoading(true);
      const res = await getAllUsers(accessToken);

      if (res?.success) {
        setUsers(res.users || []);
      } else {
        toast.error(res?.error || "Failed to fetch users");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Apply Filters
  const filteredUsers = useMemo(() => {
    return users
      .filter((user) => {
        if (statusFilter === "active") return user.is_active;
        if (statusFilter === "inactive") return user.is_active === false;
        return true;
      })
      .filter((user) => {
        if (!searchQuery) return true;

        const q = searchQuery.toLowerCase();
        const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();

        return (
          fullName.toLowerCase().includes(q) ||
          (user.email ?? "").toLowerCase().includes(q) ||
          (user.username ?? "").toLowerCase().includes(q)
        );
      });
  }, [users, statusFilter, searchQuery]);

  const totalActive = users.filter((u) => u.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header + Controls */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Users className="h-5 w-5 text-purple-600" />
            User Management
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            View and filter registered SSP users.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-3 w-3 text-purple-600" />
            <span>{users.length} total users</span>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={fetchUsers}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-purple-100 bg-purple-50/70">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <UserCheck className="h-4 w-4 text-purple-700" />
              Active users
            </CardTitle>
            <CardDescription>Users with active accounts</CardDescription>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-2xl font-semibold">{totalActive}</div>
          </CardContent>
        </Card>

        <Card className="border-purple-100">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <UserX className="h-4 w-4 text-slate-600" />
              Inactive users
            </CardTitle>
            <CardDescription>Users currently inactive</CardDescription>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-2xl font-semibold">
              {users.length - totalActive}
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-100">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-purple-600" />
              Latest registration
            </CardTitle>
            <CardDescription>Most recent user</CardDescription>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-sm">
              {users.length
                ? new Date(users[users.length - 1].created_at ?? "").toLocaleDateString()
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + List */}
      <Card className="border-purple-100">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-sm">Users</CardTitle>
              <CardDescription>
                Search and filter users similar to your UI screenshot.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative w-full min-w-[220px] md:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email"
                  className="pl-8 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Filter */}
              <Select
                value={statusFilter}
                onValueChange={(v: "all" | "active" | "inactive") => setStatusFilter(v)}
              >
                <SelectTrigger className="w-[130px] text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <ScrollArea className="h-[420px] pr-3">
            <div className="space-y-2">
              {filteredUsers.map((user) => {
                const initials =
                  (user.first_name?.[0] || user.username?.[0] || "U").toUpperCase() +
                  (user.last_name?.[0] || "").toUpperCase();

                const fullName =
                  user.first_name || user.last_name
                    ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
                    : user.username || "Unnamed user";

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-lg border border-purple-50 bg-white px-3 py-2 text-sm shadow-[0_1px_0_0_rgba(15,23,42,0.03)]"
                  >
                    {/* Left Section */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border border-purple-100">
                        <AvatarFallback className="bg-purple-50 text-xs font-medium text-purple-700">
                          {initials}
                        </AvatarFallback>
                      </Avatar>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{fullName}</span>

                          {user.gender && (
                            <Badge
                              variant="outline"
                              className="border-purple-200 bg-purple-50 text-[10px] text-purple-700"
                            >
                              {user.gender}
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>

                    {/* Right Section */}
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant="outline"
                        className={
                          user.is_active
                            ? "border-green-200 bg-green-50 text-[10px] text-green-700"
                            : "border-slate-200 bg-slate-50 text-[10px] text-slate-700"
                        }
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>

                      <span className="text-[10px] text-muted-foreground">
                        Joined{" "}
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}

              {!loading && filteredUsers.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No users found for this filter.
                </p>
              )}

              {loading && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Loading users…
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
