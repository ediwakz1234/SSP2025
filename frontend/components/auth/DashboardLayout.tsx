import { useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";

import {
  LayoutDashboard,
  GitBranch,
  BarChart3,
  Map,
  TrendingUp,
  LogOut,
  Menu,
  X,
  User,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Button } from "../ui/button";
import { supabase } from "../../lib/supabase";
import { useKMeansStore } from "../../lib/stores/kmeansStore";

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Extract the segment AFTER /user/
  const currentPath = location.pathname;
  const currentPage =
    currentPath.startsWith("/user/")
      ? currentPath.replace("/user/", "").split("/")[0]
      : "dashboard";

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/user/dashboard" },
    { id: "clustering", label: "Business Recommendation", icon: GitBranch, path: "/user/clustering" },
    { id: "analytics", label: "Analytics", icon: BarChart3, path: "/user/analytics" },
    { id: "map", label: "Map View", icon: Map, path: "/user/map" },
    {
      id: "opportunities",
      label: "Business Opportunities",
      icon: TrendingUp,
      path: "/user/opportunities",
    },
    { id: "profile", label: "My Profile", icon: User, path: "/user/profile" },
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    // Clear K-Means session data before logout
    useKMeansStore.getState().reset();
    await supabase.auth.signOut();
    navigate("/user/login");
  };

  return (
    <div className="min-h-screen w-full bg-linear-to-br from-gray-50 via-white to-gray-100/50 flex">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:relative z-50 h-full
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isSidebarOpen ? "w-72" : "w-20"}
          bg-white/95 backdrop-blur-xl border-r border-gray-100
          shadow-xl lg:shadow-lg
          transition-all duration-300 ease-out
          flex flex-col
        `}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center gap-3">
          {isSidebarOpen && (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#1e3a5f] shadow-lg shadow-slate-900/20 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="font-heading font-bold text-gray-900 truncate">Store Placement</h1>
                <p className="text-xs text-gray-500 truncate">Business Analytics</p>
              </div>
            </div>
          )}

          {!isSidebarOpen && (
            <div className="w-10 h-10 rounded-xl bg-[#1e3a5f] shadow-lg shadow-slate-900/20 flex items-center justify-center mx-auto">
              <MapPin className="w-5 h-5 text-white" />
            </div>
          )}

          {/* Desktop Toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden lg:flex text-gray-500 hover:text-gray-900 hover:bg-gray-100"
          >
            {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>

          {/* Mobile Close */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden text-gray-500 hover:text-gray-900 hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.path)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl
                  transition-all duration-200 group relative
                  ${isActive
                    ? "bg-[#1e3a5f] text-white shadow-lg shadow-slate-900/20"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }
                `}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? '' : 'group-hover:scale-110'} transition-transform`} />
                {isSidebarOpen && (
                  <span className="font-medium truncate">{item.label}</span>
                )}
                {isActive && isSidebarOpen && (
                  <div className="absolute right-3 w-2 h-2 rounded-full bg-white/50" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-100">
          <Button
            onClick={handleLogout}
            variant="destructive"
            className={`w-full ${isSidebarOpen ? '' : 'px-0 justify-center'}`}
          >
            <LogOut className="w-5 h-5" />
            {isSidebarOpen && <span>Logout</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 px-4 lg:px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(true)}
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
              Store Placement
            </h2>
          </div>

          {/* Right side - can add notifications, user avatar, etc. */}
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
