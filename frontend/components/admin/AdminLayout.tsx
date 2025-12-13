import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import {
  LayoutDashboard,
  Users,
  ListOrdered,
  Database,
  BarChart3,
  Menu,
  Shield,
} from "lucide-react";
import { Button } from "../ui/button";
import { useKMeansStore } from "../../lib/stores/kmeansStore";
import { GlobalSidebar } from "../shared/GlobalSidebar";

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  // Get admin email
  useEffect(() => {
    supabase.auth.getUser().then((res) => {
      setAdminEmail(res.data.user?.email ?? "Admin");
    });
  }, []);

  const currentPath = location.pathname;

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
    { id: "users", label: "User Management", icon: Users, path: "/admin/user-management" },
    { id: "logs", label: "Activity Logs", icon: ListOrdered, path: "/admin/activity-logs" },
    { id: "seed", label: "Seed Data", icon: Database, path: "/admin/seed-data" },
    { id: "analytics", label: "Analytics", icon: BarChart3, path: "/admin/analytics" },
  ];

  const handleLogout = async () => {
    useKMeansStore.getState().reset();
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  // Get current page title
  const getPageTitle = () => {
    const item = menuItems.find(i => {
      if (i.path === "/admin") return currentPath === "/admin";
      return currentPath.startsWith(i.path);
    });
    return item?.label || "Dashboard";
  };

  return (
    <div className="min-h-screen flex bg-linear-to-br from-slate-100 via-white to-purple-50/30">
      {/* Shared Sidebar */}
      <GlobalSidebar
        variant="admin"
        menuItems={menuItems}
        onLogout={handleLogout}
        headerIcon={Shield}
        headerTitle="Admin Portal"
        headerSubtitle="Store Placement"
        basePath="/admin"
        userProfile={adminEmail ? { email: adminEmail, role: "Administrator" } : undefined}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 lg:px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-gray-600 hover:text-gray-900"
          >
            <Menu className="w-5 h-5" />
          </Button>

          <div className="hidden lg:block">
            <h2 className="text-lg font-heading font-semibold text-gray-900">
              Admin Dashboard
            </h2>
            <p className="text-sm text-gray-500">Strategic Store Placement System</p>
          </div>

          {/* Mobile Title */}
          <div className="lg:hidden text-center flex-1">
            <h2 className="text-base font-heading font-semibold text-gray-900">
              {getPageTitle()}
            </h2>
          </div>

          {/* Right side placeholder */}
          <div className="w-10 lg:w-auto" />
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
