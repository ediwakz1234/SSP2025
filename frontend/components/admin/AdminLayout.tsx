import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import {
  LayoutDashboard,
  Users,
  ListOrdered,
  Database,
  BarChart3,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "../ui/button";
import { useKMeansStore } from "../../lib/stores/kmeansStore";

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    // Clear K-Means session data before logout
    useKMeansStore.getState().reset();
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const isActive = (path: string) => {
    if (path === "/admin") return currentPath === "/admin";
    return currentPath.startsWith(path);
  };

  return (
    <div className="min-h-screen flex bg-linear-to-br from-slate-100 via-white to-purple-50/30">
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
          {isSidebarOpen ? (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-600 to-fuchsia-600 shadow-lg shadow-purple-500/25 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="font-heading font-bold text-gray-900 truncate">Admin Portal</h1>
                <p className="text-xs text-gray-500 truncate">Store Placement</p>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-600 to-fuchsia-600 shadow-lg shadow-purple-500/25 flex items-center justify-center mx-auto">
              <Shield className="w-5 h-5 text-white" />
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

        {/* Admin Profile */}
        <div className="p-4 flex items-center gap-3 border-b border-gray-100">
          <div className="w-11 h-11 rounded-xl bg-linear-to-br from-purple-500 to-fuchsia-500 text-white flex items-center justify-center text-lg font-bold shadow-md shadow-purple-500/20 shrink-0">
            {adminEmail?.charAt(0).toUpperCase()}
          </div>

          {isSidebarOpen && (
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-gray-900 truncate">{adminEmail}</p>
              <span className="inline-flex items-center text-xs bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full font-medium mt-1">
                Administrator
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.path)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl
                  transition-all duration-200 group relative
                  ${active
                    ? "bg-linear-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/25"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }
                `}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? '' : 'group-hover:scale-110'} transition-transform`} />
                {isSidebarOpen && (
                  <span className="font-medium truncate">{item.label}</span>
                )}
                {active && isSidebarOpen && (
                  <div className="absolute right-3 w-2 h-2 rounded-full bg-white/50" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
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
              Admin Dashboard
            </h2>
            <p className="text-sm text-gray-500">Strategic Store Placement System</p>
          </div>

          {/* Mobile Title */}
          <div className="lg:hidden text-center flex-1">
            <h2 className="text-base font-heading font-semibold text-gray-900">
              Admin Portal
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
