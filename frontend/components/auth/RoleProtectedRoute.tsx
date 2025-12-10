import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../../lib/supabase";
import { Loader2 } from "lucide-react";

interface Props {
  children: JSX.Element;
  role: "admin" | "user";
}

export function RoleProtectedRoute({ children, role }: Props) {
  const { user, loading } = useAuth();
  const [hasRole, setHasRole] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) return;

    // No user = not logged in
    if (!user) {
      setHasRole(false);
      setChecking(false);
      return;
    }

    const userId = user.id;

    async function checkRole() {
      try {
        if (role === "admin") {
          // For admin: check if user exists in admin_profiles table
          const { data, error } = await supabase
            .from("admin_profiles")
            .select("id, role")
            .eq("id", userId)
            .single();

          if (error || !data) {
            console.log("Admin check failed:", error?.message || "No admin profile found");
            setHasRole(false);
          } else {
            // User exists in admin_profiles = they are an admin
            setHasRole(true);
          }
        } else {
          // For regular user: check profiles table
          const { data, error } = await supabase
            .from("profiles")
            .select("id, role")
            .eq("id", userId)
            .single();

          if (error || !data) {
            setHasRole(false);
          } else {
            setHasRole(true);
          }
        }
      } catch (err) {
        console.error("Role check error:", err);
        setHasRole(false);
      }
      setChecking(false);
    }

    checkRole();
  }, [user, loading, role]);

  // ⏳ Show loading while waiting for auth OR role check
  if (loading || checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Verifying permissions...</span>
        </div>
      </div>
    );
  }

  // ❌ Not logged in
  if (!user) {
    return role === "admin"
      ? <Navigate to="/admin/login" replace />
      : <Navigate to="/user/login" replace />;
  }

  // ❌ Doesn't have required role
  if (!hasRole) {
    return role === "admin"
      ? <Navigate to="/admin/login" replace />
      : <Navigate to="/user/login" replace />;
  }

  return children;
}
