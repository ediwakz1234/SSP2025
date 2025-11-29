import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

interface Props {
  children: JSX.Element;
  role: "admin" | "user";
}

export function RoleProtectedRoute({ children, role }: Props) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  // Not logged in
  if (!user) return <Navigate to="/user/login" replace />;

  // Get Supabase role from metadata
  const userRole = user.user_metadata?.role;

  // If role mismatch → block access
  if (userRole !== role) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
