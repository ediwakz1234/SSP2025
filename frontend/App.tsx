import { Routes, Route, Navigate } from "react-router-dom";

// AUTH SYSTEM
import { AuthProvider } from "./components/auth/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { RoleProtectedRoute } from "./components/auth/RoleProtectedRoute";

// PUBLIC PAGES
import { LandingPage } from "./components/landing/LandingPage";
import { UserLogin } from "./components/auth/UserLogin";
import { AdminLoginPage } from "./components/auth/AdminLoginPage";
import { Register } from "./components/auth/Register";
import { ForgotPasswordPage } from "./components/auth/ForgotPasswordPage";

// NEW OTP RESET COMPONENTS
import { EnterCodePage } from "./components/auth/EnterCodePage";
import { ResetPasswordPage } from "./components/auth/ResetPasswordPage";
import { ResetPasswordSuccessPage } from "./components/auth/ResetPasswordSuccessPage";

// USER PAGES
import { DashboardLayout as UserDashboardLayout } from "./components/auth/DashboardLayout";
import { DashboardPage as UserDashboardPage } from "./components/users/DashboardPage";
import { UserAnalyticsPage as UserAnalyticsPage } from "./components/users/UserAnalyticsPage";
import { ClusteringPage } from "./components/users/ClusteringPage";
import { MapPage } from "./components/users/MapPage";
import { OpportunitiesPage } from "./components/users/OpportunitiesPage";
import { Profile } from "./components/users/Profile";

// ADMIN PAGES
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminPortal } from "./components/admin/AdminPortal";
import { ActivityLogsPage } from "./components/admin/ActivityLogsPage";
import { UserManagement } from "./components/admin/UserManagement";
import { SeedDataManagement } from "./components/admin/SeedDataManagement";
import { AdminAnalyticsPage } from "./components/admin/AdminAnalyticsPage";

// UI
import { Toaster } from "./components/ui/sonner";

export function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />

      <Routes>

        {/* PUBLIC ROUTES */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/user/login" element={<UserLogin />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* 🔵 ENTER OTP CODE */}
        <Route path="/enter-code" element={<EnterCodePage />} />

        {/* 🟩 FINAL PASSWORD RESET PAGE */}
        <Route path="/reset-password-final" element={<ResetPasswordPage />} />

        {/* 🟧 SUCCESS PAGE */}
        <Route path="/reset-password-success" element={<ResetPasswordSuccessPage />} />

        {/* USER PROTECTED ROUTES */}
        <Route
          path="/user"
          element={
            <ProtectedRoute>
              <UserDashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<UserDashboardPage />} />
          <Route path="analytics" element={<UserAnalyticsPage />} />
          <Route path="clustering" element={<ClusteringPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="opportunities" element={<OpportunitiesPage />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* ADMIN PROTECTED ROUTES */}
        <Route
          path="/admin"
          element={
            <RoleProtectedRoute role="admin">
              <AdminLayout />
            </RoleProtectedRoute>
          }
        >
          <Route index element={<AdminPortal />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="activity-logs" element={<ActivityLogsPage />} />
          <Route path="user-management" element={<UserManagement />} />
          <Route path="seed-data" element={<SeedDataManagement />} />
        </Route>

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </AuthProvider>
  );
}
