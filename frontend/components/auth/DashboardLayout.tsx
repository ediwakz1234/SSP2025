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
} from "lucide-react";

import { Button } from "../ui/button";
import { supabase } from "../../lib/supabase";

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Determine current page
  const currentPath = location.pathname;
  const currentPage =
    currentPath === "/user"
      ? "dashboard"
      : currentPath.replace("/user/", "");

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/user" },
    { id: "clustering", label: "K-Means Clustering", icon: GitBranch, path: "/user/clustering" },
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
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/user/login");
  };

  return (
    <div className="min-h-screen w-full bg-white flex">
      
      {/* Sidebar */}
      <aside
        className={`bg-white text-black border-r border-gray-300 shadow-sm transition-all duration-300 ${
          isSidebarOpen ? "w-64" : "w-20"
        } flex flex-col`}
      >
        {/* Logo/Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {isSidebarOpen && (
            <div>
              <h1 className="font-bold text-lg">Store Placement</h1>
              <p className="text-xs text-gray-500">
                Strategic Business Location Analysis
              </p>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-black hover:bg-gray-200"
          >
            {isSidebarOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-black text-white"
                    : "text-black hover:bg-gray-200"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {isSidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-sm bg-black text-white hover:bg-gray-900 rounded-lg px-3 py-2 transition"
          >
            <LogOut className="w-5 h-5" />
            {isSidebarOpen && <span className="ml-3">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-white">
        
        {/* Header */}
        <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-white text-black">
          <div>
            <h2 className="text-lg font-semibold">Sta. Maria, Bulacan</h2>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Strategic Store Placement Dashboard</span>
            </div>
          </div>

          <div className="text-right text-sm text-gray-700">
            <div className="font-medium">Barangay Sta. Cruz</div>
            <div className="text-gray-500">
              Population: 11,364 | Area: Central Luzon
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6">
          <Outlet />   {/* ← FIXED: correctly renders nested user pages */}
        </div>

      </main>
    </div>
  );
}
