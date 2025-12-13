import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    LogOut,
    Menu,
    X,
    ChevronLeft,
    ChevronRight,
    LucideIcon,
} from "lucide-react";
import { Button } from "../ui/button";

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

export interface MenuItem {
    id: string;
    label: string;
    icon: LucideIcon;
    path: string;
}

export interface MenuCategory {
    category: string;
    items: MenuItem[];
}

export interface GlobalSidebarProps {
    variant: "user" | "admin";
    menuItems?: MenuItem[];
    menuCategories?: MenuCategory[];
    onLogout: () => void;
    headerIcon: LucideIcon;
    headerTitle: string;
    headerSubtitle: string;
    userProfile?: {
        email: string;
        role: string;
    };
    basePath: string;
}

// -----------------------------------------------------------------------------
// THEME CONFIG
// -----------------------------------------------------------------------------

const themes = {
    user: {
        primary: "bg-[#1e3a5f]",
        primaryShadow: "shadow-slate-900/20",
        activeItem: "bg-[#1e3a5f] text-white shadow-lg shadow-slate-900/20",
        background: "bg-linear-to-br from-gray-50 via-white to-gray-100/50",
        profileBg: "bg-[#1e3a5f]",
    },
    admin: {
        primary: "bg-slate-700",
        primaryShadow: "shadow-slate-900/20",
        activeItem: "bg-slate-700 text-white shadow-lg shadow-slate-700/25",
        background: "bg-linear-to-br from-slate-100 via-white to-purple-50/30",
        profileBg: "bg-slate-600",
    },
};

// -----------------------------------------------------------------------------
// COMPONENT
// -----------------------------------------------------------------------------

export function GlobalSidebar({
    variant,
    menuItems,
    menuCategories,
    onLogout,
    headerIcon: HeaderIcon,
    headerTitle,
    headerSubtitle,
    userProfile,
    basePath,
}: GlobalSidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const theme = themes[variant];
    const currentPath = location.pathname;

    const handleNavigate = (path: string) => {
        navigate(path);
        setIsMobileMenuOpen(false);
    };

    const isActive = (path: string, itemId?: string) => {
        if (menuCategories) {
            // For categorized menus, check by item ID
            const currentPage = currentPath.startsWith(basePath + "/")
                ? currentPath.replace(basePath + "/", "").split("/")[0]
                : currentPath === basePath ? "dashboard" : "";
            return currentPage === itemId;
        }
        // For flat menus
        if (path === basePath) return currentPath === basePath;
        return currentPath.startsWith(path);
    };

    return (
        <>
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
          fixed lg:sticky lg:top-0 z-50 h-screen
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isSidebarOpen ? "w-64" : "w-20"}
          bg-white border-r border-gray-100
          shadow-xl lg:shadow-md
          transition-all duration-300 ease-out
          flex flex-col
        `}
            >
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex items-center gap-3">
                    {isSidebarOpen ? (
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`w-10 h-10 rounded-xl ${theme.primary} shadow-lg ${theme.primaryShadow} flex items-center justify-center shrink-0`}>
                                <HeaderIcon className="w-5 h-5 text-white" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="font-heading font-bold text-gray-900 truncate">{headerTitle}</h1>
                                <p className="text-xs text-gray-500 truncate">{headerSubtitle}</p>
                            </div>
                        </div>
                    ) : (
                        <div className={`w-10 h-10 rounded-xl ${theme.primary} shadow-lg ${theme.primaryShadow} flex items-center justify-center mx-auto`}>
                            <HeaderIcon className="w-5 h-5 text-white" />
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

                {/* User Profile (Admin only) */}
                {userProfile && (
                    <div className="p-4 flex items-center gap-3 border-b border-gray-100">
                        <div className={`w-11 h-11 rounded-xl ${theme.profileBg} text-white flex items-center justify-center text-lg font-bold shadow-md shadow-slate-500/20 shrink-0`}>
                            {userProfile.email?.charAt(0).toUpperCase()}
                        </div>

                        {isSidebarOpen && (
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm text-gray-900 truncate">{userProfile.email}</p>
                                <span className="inline-flex items-center text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-medium mt-1">
                                    {userProfile.role}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 p-3 overflow-y-auto">
                    {/* Categorized Menu (User) */}
                    {menuCategories && menuCategories.map((category, catIdx) => (
                        <div key={category.category} className={catIdx > 0 ? "mt-4" : ""}>
                            {/* Category Header */}
                            {isSidebarOpen && (
                                <div className="px-3 py-2">
                                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        {category.category}
                                    </span>
                                </div>
                            )}

                            {/* Menu Items */}
                            <div className="space-y-1">
                                {category.items.map((item) => {
                                    const Icon = item.icon;
                                    const active = isActive(item.path, item.id);

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => handleNavigate(item.path)}
                                            className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                        transition-all duration-200 group relative
                        ${active
                                                    ? theme.activeItem
                                                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                                }
                      `}
                                        >
                                            <Icon className={`w-5 h-5 shrink-0 ${active ? '' : 'group-hover:scale-110'} transition-transform`} />
                                            {isSidebarOpen && (
                                                <span className="text-sm font-medium text-left">{item.label}</span>
                                            )}
                                            {active && isSidebarOpen && (
                                                <div className="absolute right-3 w-2 h-2 rounded-full bg-white/50" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Flat Menu (Admin) */}
                    {menuItems && !menuCategories && (
                        <div className="space-y-1.5">
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
                                                ? theme.activeItem
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
                        </div>
                    )}
                </nav>

                {/* Logout Button */}
                <div className="mt-auto p-4 border-t border-gray-100">
                    <Button
                        onClick={onLogout}
                        variant="destructive"
                        className={`w-full ${isSidebarOpen ? '' : 'px-0 justify-center'}`}
                    >
                        <LogOut className="w-5 h-5" />
                        {isSidebarOpen && <span>Logout</span>}
                    </Button>
                </div>
            </aside>

            {/* Mobile Menu Button - Exposed for parent to use */}
            <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden fixed top-4 left-4 z-30 p-2 bg-white rounded-lg shadow-md"
                style={{ display: isMobileMenuOpen ? 'none' : 'block' }}
            >
                <Menu className="w-5 h-5 text-gray-600" />
            </button>
        </>
    );
}

export { GlobalSidebar as default };
