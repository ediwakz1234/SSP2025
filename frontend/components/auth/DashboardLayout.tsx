import { useNavigate, useLocation, Outlet } from "react-router-dom";

import {
  LayoutDashboard,
  GitBranch,
  BarChart3,
  Map,
  TrendingUp,
  Menu,
  User,
  MapPin,
} from "lucide-react";

import { Button } from "../ui/button";
import { supabase } from "../../lib/supabase";
import { useKMeansStore } from "../../lib/stores/kmeansStore";
import { GlobalSidebar } from "../shared/GlobalSidebar";

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Menu items organized by category
  const menuCategories = [
    {
      category: "Main",
      items: [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/user/dashboard" },
      ]
    },
    {
      category: "Tools",
      items: [
        { id: "clustering", label: "Business Recommendation", icon: GitBranch, path: "/user/clustering" },
        { id: "opportunities", label: "Business Opportunities", icon: TrendingUp, path: "/user/opportunities" },
        { id: "analytics", label: "Analytics", icon: BarChart3, path: "/user/analytics" },
        { id: "map", label: "Map View", icon: Map, path: "/user/map" },
      ]
    },
    {
      category: "Account",
      items: [
        { id: "profile", label: "My Profile", icon: User, path: "/user/profile" },
      ]
    }
  ];

  const handleLogout = async () => {
    useKMeansStore.getState().reset();
    await supabase.auth.signOut();
    navigate("/user/login");
  };

  // Extract current page for header
  const currentPath = location.pathname;
  const currentPage = currentPath.startsWith("/user/")
    ? currentPath.replace("/user/", "").split("/")[0]
    : "dashboard";

  const getPageTitle = () => {
    for (const cat of menuCategories) {
      const item = cat.items.find(i => i.id === currentPage);
      if (item) return item.label;
    }
    return "Dashboard";
  };

  return (
    <div className="min-h-screen w-full bg-linear-to-br from-gray-50 via-white to-gray-100/50 flex">
      {/* Shared Sidebar */}
      <GlobalSidebar
        variant="user"
        menuCategories={menuCategories}
        onLogout={handleLogout}
        headerIcon={MapPin}
        headerTitle="Store Placement"
        headerSubtitle="Business Analytics"
        basePath="/user"
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
              Sta. Cruz, Santa Maria, Bulacan
            </h2>
            <p className="text-sm text-gray-500">Strategic Store Placement Dashboard</p>
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
