import { ReactNode, useState } from "react";
import {
    LayoutDashboard,
    GitBranch,
    BarChart3,
    Map,
    TrendingUp,
    LogOut,
    Menu,
    X
} from "lucide-react";
import { Button } from "./ui/button";

interface DashboardLayoutProps {
    children: ReactNode;
    currentPage: string;
    onNavigate: (page: string) => void;
    onLogout: () => void;
}

export function DashboardLayout({ children, currentPage, onNavigate, onLogout }: DashboardLayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const menuItems = [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "clustering", label: "K-Means Clustering", icon: GitBranch },
        { id: "analytics", label: "Analytics", icon: BarChart3 },
        { id: "map", label: "Map View", icon: Map },
        { id: "opportunities", label: "Business Opportunities", icon: TrendingUp },
    ];

    return (
        <div className="min-h-screen w-full bg-background flex">
            {/* Sidebar */}
            <aside
                className={`bg-card border-r border-border transition-all duration-300 ${isSidebarOpen ? "w-64" : "w-20"
                    } flex flex-col`}
            >
                {/* Logo/Header */}
                <div className="p-4 border-b border-border flex items-center justify-between">
                    {isSidebarOpen && (
                        <div className="flex items-center gap-2">
                            <div className="bg-primary text-primary-foreground p-2 rounded">
                                <GitBranch className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-sm">Store Placement</h2>
                                <p className="text-xs text-muted-foreground">Analysis System</p>
                            </div>
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2"
                    >
                        {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
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
                                onClick={() => onNavigate(item.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "hover:bg-accent text-foreground"
                                    }`}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                {isSidebarOpen && <span>{item.label}</span>}
                            </button>
                        );
                    })}
                </nav>

                {/* Logout */}
                <div className="p-4 border-t border-border">
                    <Button
                        variant="outline"
                        onClick={onLogout}
                        className={`w-full ${isSidebarOpen ? "justify-start" : "justify-center"}`}
                    >
                        <LogOut className="w-5 h-5" />
                        {isSidebarOpen && <span className="ml-3">Logout</span>}
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar */}
                <header className="bg-card border-b border-border p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl">
                                {menuItems.find(item => item.id === currentPage)?.label || "Dashboard"}
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Brgy. Sta. Cruz, Santa Maria, Bulacan
                            </p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                            Population: 11,364 | Area: Central Luzon
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto p-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
