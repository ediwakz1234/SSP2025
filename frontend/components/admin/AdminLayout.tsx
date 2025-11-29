import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase"; // 
import { Button } from "../ui/button";

export function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-gray-50">

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r shadow-sm p-6">
        <h2 className="text-xl font-bold mb-6">Admin Panel</h2>

        <nav className="space-y-3">
          <p
            onClick={() => navigate("/admin")}
            className="cursor-pointer text-sm hover:text-primary"
          >
            Dashboard
          </p>

          <p
            onClick={() => navigate("/admin/users")}
            className="cursor-pointer text-sm hover:text-primary"
          >
            User Management
          </p>

          <p
            onClick={() => navigate("/admin/activity-logs")}
            className="cursor-pointer text-sm hover:text-primary"
          >
            Activity Logs
          </p>

          <p
            onClick={() => navigate("/admin/seed-data")}
            className="cursor-pointer text-sm hover:text-primary"
          >
            Seed Data Management
          </p>

          <p
            onClick={() => navigate("/admin/analytics")}
            className="cursor-pointer text-sm hover:text-primary"
          >
            Analytics
          </p>
        </nav>

        <Button className="mt-10 w-full" onClick={handleLogout}>
          Logout
        </Button>
      </aside>

      {/* Page Content */}
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
