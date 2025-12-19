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
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select";

import { toast } from "sonner";

import {
  Users,
  Search,
  RefreshCcw,
  UserCheck,
  Calendar,
  Activity,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  Trash2,
  Edit2,
  X,
  BarChart3,
  Mail,
  User,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import { logActivity } from "../../utils/activity";

type ApprovalStatus = "pending" | "approved" | "declined" | "flagged";

interface ProfileUser {
  id: string;
  full_name: string | null;
  email: string | null;
  address: string | null;
  approval_status: ApprovalStatus;
  role: "admin" | "user";
  last_login: string | null;
  created_at: string | null;
  analyses_count: number;
}

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { label: "Pending", color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200", icon: Clock },
  approved: { label: "Approved", color: "text-green-600", bgColor: "bg-green-50 border-green-200", icon: CheckCircle },
  declined: { label: "Declined", color: "text-red-600", bgColor: "bg-red-50 border-red-200", icon: XCircle },
  flagged: { label: "Flagged – Outside Location", color: "text-orange-600", bgColor: "bg-orange-50 border-orange-200", icon: AlertTriangle },
};

// Address validation helper
function isValidAddress(address: string): boolean {
  if (!address) return false;
  const normalized = address.toLowerCase().trim();
  return normalized.includes("sta. cruz") || normalized.includes("santa cruz");
}

// ============================================================================
// DELETE CONFIRMATION MODAL
// ============================================================================
function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  userName,
  isDeleting
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName: string;
  isDeleting: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="bg-red-50 p-6 border-b border-red-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Delete User</h2>
              <p className="text-sm text-gray-600">This action cannot be undone</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-600">
            Are you sure you want to delete <span className="font-semibold text-gray-900">"{userName}"</span>?
          </p>
          <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                This will permanently remove the user's account, profile data, and all associated activity logs.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-6 bg-gray-50 border-t">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete User
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EDIT USER MODAL
// ============================================================================
function EditUserModal({
  isOpen,
  onClose,
  onSave,
  user,
  isSaving
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    full_name: string;
    email: string;
    address: string;
    approval_status: ApprovalStatus;
    role: "admin" | "user";
  }) => void;
  user: ProfileUser | null;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    address: "",
    approval_status: "pending" as ApprovalStatus,
    role: "user" as "admin" | "user",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addressWarning, setAddressWarning] = useState(false);

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        email: user.email || "",
        address: user.address || "",
        approval_status: user.approval_status,
        role: user.role,
      });
      setAddressWarning(!isValidAddress(user.address || ""));
    }
  }, [user]);

  // Check address on change
  useEffect(() => {
    if (formData.address) {
      const isValid = isValidAddress(formData.address);
      setAddressWarning(!isValid);
      // Auto-flag if address is invalid
      if (!isValid && formData.approval_status !== "flagged") {
        // Don't auto-change, just warn
      }
    }
  }, [formData.address, formData.approval_status]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = "Full name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!formData.address.trim()) {
      newErrors.address = "Address is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // If address is invalid, set status to flagged
    const finalData = { ...formData };
    if (!isValidAddress(formData.address)) {
      finalData.approval_status = "flagged";
    }

    onSave(finalData);
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="bg-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Edit2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Edit User</h2>
                <p className="text-sm text-white/80">Update user information</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline-block mr-1" />
              Full Name *
            </label>
            <Input
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="John Doe"
              error={!!errors.full_name}
            />
            {errors.full_name && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.full_name}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline-block mr-1" />
              Email *
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john@example.com"
              error={!!errors.email}
            />
            {errors.email && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.email}
              </p>
            )}
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline-block mr-1" />
              Address *
            </label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Sta. Cruz, Santa Maria, Bulacan"
              error={!!errors.address || addressWarning}
            />
            {errors.address && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.address}
              </p>
            )}
            {addressWarning && !errors.address && (
              <p className="text-xs text-orange-600 mt-1 flex items-center gap-1 bg-orange-50 p-2 rounded-lg">
                <AlertTriangle className="w-3 h-3" />
                Outside Service Area – User will be flagged
              </p>
            )}
          </div>

          {/* Status & Role Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <Select
                value={formData.approval_status}
                onValueChange={(v) => setFormData({ ...formData, approval_status: v as ApprovalStatus })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                  <SelectItem value="flagged">Flagged</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <Select
                value={formData.role}
                onValueChange={(v) => setFormData({ ...formData, role: v as "admin" | "user" })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-purple-600 hover:bg-purple-700"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function UserManagement() {
  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [analysesMap, setAnalysesMap] = useState<Record<string, number>>({});
  const [_loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ProfileUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch analyses count per user from activity logs
  const fetchAnalysesCount = async () => {
    const { data, error } = await supabase
      .from("activity_logs")
      .select("user_id, action")
      .or("action.ilike.%clustering%,action.ilike.%ran clustering%,action.eq.clustering_analysis");

    if (error) {
      console.error("Error fetching analyses:", error);
      return;
    }

    // Count per user
    const countMap: Record<string, number> = {};
    (data || []).forEach((log) => {
      if (log.user_id) {
        countMap[log.user_id] = (countMap[log.user_id] || 0) + 1;
      }
    });
    setAnalysesMap(countMap);
  };

  const fetchUsers = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, first_name, last_name, email, address, approval_status, role, created_at, last_login, analyses_count")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("USER FETCH ERROR:", error);
      toast.error("Failed to load users");
      setLoading(false);
      return;
    }

    const usersList: ProfileUser[] = (data || []).map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email,
      address: u.address,
      approval_status: u.approval_status || "pending",
      role: u.role === "admin" ? "admin" : "user",
      created_at: u.created_at,
      last_login: u.last_login,
      analyses_count: u.analyses_count || 0,
    }));

    setUsers(usersList);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
    fetchAnalysesCount();
  }, []);

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel("profiles_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (_payload) => {
          fetchUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUserAction = async (userId: string, action: "approve" | "decline") => {
    setActionLoading(userId);

    try {
      const newStatus = action === "approve" ? "approved" : "declined";

      const { error } = await supabase
        .from("profiles")
        .update({ approval_status: newStatus })
        .eq("id", userId);

      if (error) throw error;

      const { data: { user: adminUser } } = await supabase.auth.getUser();
      await supabase.from("activity_logs").insert({
        user_id: adminUser?.id,
        action: `user_${action}d`,
        user_email: adminUser?.email,
        details: `User ${action}d`,
        metadata: { target_user_id: userId, new_status: newStatus }
      });

      toast.success(`User ${action}d successfully`);
      fetchUsers();
    } catch (err) {
      console.error(`Error ${action}ing user:`, err);
      toast.error(`Failed to ${action} user`);
    } finally {
      setActionLoading(null);
    }
  };

  // DELETE USER
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setIsDeleting(true);

    try {
      // Delete from profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", selectedUser.id);

      if (profileError) throw profileError;

      // Log the deletion
      const { data: { user: adminUser } } = await supabase.auth.getUser();
      await supabase.from("activity_logs").insert({
        user_id: adminUser?.id,
        action: "user_deleted",
        user_email: adminUser?.email,
        details: `User "${selectedUser.full_name}" deleted`,
        metadata: {
          deleted_user_id: selectedUser.id,
          deleted_user_email: selectedUser.email,
          deleted_user_name: selectedUser.full_name
        }
      });

      // Log activity
      logActivity("User Deleted", {
        target_user_id: selectedUser.id,
        target_user_email: selectedUser.email,
        action_type: "user_deleted"
      });

      toast.success(`User "${selectedUser.full_name}" deleted successfully`);
      setDeleteModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      console.error("Error deleting user:", err);
      toast.error("Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  };

  // EDIT USER
  const handleSaveUser = async (data: {
    full_name: string;
    email: string;
    address: string;
    approval_status: ApprovalStatus;
    role: "admin" | "user";
  }) => {
    if (!selectedUser) return;
    setIsSaving(true);

    try {
      // Check address validation
      const finalStatus = isValidAddress(data.address) ? data.approval_status : "flagged";

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
          email: data.email,
          address: data.address,
          approval_status: finalStatus,
          role: data.role,
        })
        .eq("id", selectedUser.id);

      if (error) throw error;

      // Log the update
      const { data: { user: adminUser } } = await supabase.auth.getUser();
      await supabase.from("activity_logs").insert({
        user_id: adminUser?.id,
        action: "user_updated",
        user_email: adminUser?.email,
        details: `User "${data.full_name}" updated`,
        metadata: {
          target_user_id: selectedUser.id,
          changes: {
            full_name: data.full_name,
            email: data.email,
            address: data.address,
            status: finalStatus,
            role: data.role
          }
        }
      });

      // Log activity
      logActivity("User Updated", {
        target_user_id: selectedUser.id,
        new_status: finalStatus,
        action_type: "user_updated"
      });

      toast.success(`User "${data.full_name}" updated successfully`);
      setEditModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      console.error("Error updating user:", err);
      toast.error("Failed to update user");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users
      .filter((u) =>
        roleFilter === "all" ? true : u.role === roleFilter
      )
      .filter((u) =>
        statusFilter === "all" ? true : u.approval_status === statusFilter
      )
      .filter((u) => {
        const q = searchQuery.toLowerCase();
        return (
          (u.full_name || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          (u.address || "").toLowerCase().includes(q)
        );
      });
  }, [users, roleFilter, statusFilter, searchQuery]);

  const totalUsers = users.length;
  const pendingCount = users.filter((u) => u.approval_status === "pending").length;
  const flaggedCount = users.filter((u) => u.approval_status === "flagged").length;
  const approvedCount = users.filter((u) => u.approval_status === "approved").length;

  function isUserActive(lastLogin: string | null) {
    if (!lastLogin) return false;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - new Date(lastLogin).getTime() < sevenDays;
  }

  // Get analyses count for a user (from activity logs)
  const getUserAnalysesCount = (userId: string, profileCount: number) => {
    return analysesMap[userId] || profileCount || 0;
  };

  return (
    <div className="page-wrapper space-y-6">
      {/* Delete Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setSelectedUser(null);
        }}
        onConfirm={handleDeleteUser}
        userName={selectedUser?.full_name || "User"}
        isDeleting={isDeleting}
      />

      {/* Edit Modal */}
      <EditUserModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedUser(null);
        }}
        onSave={handleSaveUser}
        user={selectedUser}
        isSaving={isSaving}
      />

      {/* Hero Header */}
      <div className="page-content relative overflow-hidden rounded-2xl bg-slate-700 p-6 text-white">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">User Management</h1>
              <p className="text-white/80 text-sm mt-1">
                Manage and approve {totalUsers} registered users
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              fetchUsers();
              fetchAnalysesCount();
            }}
            className="bg-white text-slate-700 hover:bg-white/90 border-0">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="stagger-children grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="stat-card-modern stat-primary">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
              <p className="text-xs text-gray-400 mt-1">Registered accounts</p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="stat-card-modern stat-warning">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Pending Approval</p>
              <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
              <p className="text-xs text-gray-400 mt-1">Awaiting review</p>
            </div>
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="stat-card-modern" style={{ borderLeft: '4px solid #f97316' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Flagged Users</p>
              <p className="text-2xl font-bold text-gray-900">{flaggedCount}</p>
              <p className="text-xs text-gray-400 mt-1">Outside service area</p>
            </div>
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="stat-card-modern stat-success">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Approved</p>
              <p className="text-2xl font-bold text-gray-900">{approvedCount}</p>
              <p className="text-xs text-gray-400 mt-1">Active users</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>

      {/* User List */}
      <Card className="border-0 shadow-card overflow-hidden animate-fadeInUp delay-100">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">All Users</CardTitle>
              <CardDescription>
                Showing {filteredUsers.length} of {totalUsers} users
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, or address..."
                className="pl-12 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-gray-50 border-gray-200">
                <SelectValue placeholder="Status filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[140px] bg-gray-50 border-gray-200">
                <SelectValue placeholder="Role filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* User Cards */}
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-3">
              {filteredUsers.map((u) => {
                const statusConfig = STATUS_CONFIG[u.approval_status];
                const StatusIcon = statusConfig.icon;
                const isFlagged = u.approval_status === "flagged";
                const needsAction = u.approval_status === "pending" || u.approval_status === "flagged";
                const analysesCount = getUserAnalysesCount(u.id, u.analyses_count);

                return (
                  <div
                    key={u.id}
                    className={`flex flex-col lg:flex-row lg:items-center justify-between p-5 rounded-xl transition-all duration-200 group ${isFlagged
                      ? "bg-orange-50 border-2 border-orange-200 hover:border-orange-300"
                      : u.approval_status === "pending"
                        ? "bg-amber-50 border border-amber-200 hover:border-amber-300"
                        : "bg-gray-50 hover:bg-gray-100"
                      }`}
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <Avatar className="h-14 w-14 border-2 border-white shadow-md">
                        <AvatarFallback className={`font-semibold ${isFlagged
                          ? "bg-gradient-to-br from-orange-400 to-red-500 text-white"
                          : "bg-slate-700 text-white"
                          }`}>
                          {getInitials(u.full_name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-semibold text-gray-900">{u.full_name || "No Name"}</p>
                          <span className={`badge-modern ${u.role === "admin" ? "badge-primary" : "badge-info"}`}>
                            {u.role}
                          </span>
                          {/* Approval Status Badge */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusConfig.bgColor} ${statusConfig.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                          {isUserActive(u.last_login) && (
                            <span className="badge-modern badge-success">
                              Active
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-500 truncate">{u.email}</p>

                        {/* Address */}
                        {u.address && (
                          <div className="flex items-start gap-1 mt-2 text-xs text-gray-500">
                            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <span className={`${isFlagged ? "text-orange-600 font-medium" : ""}`}>
                              {u.address}
                              {isFlagged && (
                                <span className="ml-2 text-orange-500 bg-orange-100 px-1.5 py-0.5 rounded text-xs">
                                  Outside Service Area
                                </span>
                              )}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Joined: {u.created_at ? new Date(u.created_at).toLocaleDateString() : "N/A"}
                          </div>

                          {u.last_login && (
                            <div className="flex items-center gap-1">
                              <Activity className="h-3 w-3" />
                              Last: {new Date(u.last_login).toLocaleDateString()}
                            </div>
                          )}

                          {/* Analyses Count */}
                          {u.role !== "admin" && (
                            <div className="flex items-center gap-1 text-purple-600">
                              <BarChart3 className="h-3 w-3" />
                              Analyses: {analysesCount}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4 lg:mt-0 lg:ml-4 flex-wrap">
                      {/* Approve/Decline for pending/flagged */}
                      {u.role !== "admin" && needsAction && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300"
                            onClick={() => handleUserAction(u.id, "approve")}
                            disabled={actionLoading === u.id}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300"
                            onClick={() => handleUserAction(u.id, "decline")}
                            disabled={actionLoading === u.id}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Decline
                          </Button>
                        </>
                      )}

                      {/* Edit Button - available for all non-admin users */}
                      {u.role !== "admin" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 hover:border-purple-300"
                          onClick={() => {
                            setSelectedUser(u);
                            setEditModalOpen(true);
                          }}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      )}

                      {/* Delete Button - available for all non-admin users */}
                      {u.role !== "admin" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300"
                          onClick={() => {
                            setSelectedUser(u);
                            setDeleteModalOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      )}

                      {/* Admin badge */}
                      {u.role === "admin" && (
                        <div className="flex items-center gap-2 text-purple-600">
                          <Shield className="w-5 h-5" />
                          <span className="text-sm font-medium">Admin</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredUsers.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500">No users found matching your criteria.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function getInitials(name?: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}
