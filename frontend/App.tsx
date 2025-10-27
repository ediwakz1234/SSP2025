import { useState, useEffect } from "react";
import { Login } from "./components/Login";
import { Register } from "./components/Register";
import { ForgotPassword } from "./components/ForgotPassword";
import { DashboardLayout } from "./components/DashboardLayout";
import { DashboardPage } from "./components/DashboardPage";
import { ClusteringPage } from "./components/ClusteringPage";
import { AnalyticsPage } from "./components/AnalyticsPage";
import { MapPage } from "./components/MapPage";
import { OpportunitiesPage } from "./components/OpportunitiesPage";
import { Toaster } from "./components/ui/sonner";
import { isAuthenticated, logout } from "./utils/auth";

type AuthView = "login" | "register" | "forgot-password";

export default function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [authView, setAuthView] = useState<AuthView>("login");
    const [currentPage, setCurrentPage] = useState("dashboard");

    // Check authentication on mount
    useEffect(() => {
        const checkAuth = async () => {
            const auth = await isAuthenticated();
            if (auth) {
                setIsLoggedIn(true);
            }
        };
        checkAuth();
    }, []);

    // Expose navigate function globally for Quick Actions
    useEffect(() => {
        (window as any).navigateTo = handleNavigate;
        return () => {
            delete (window as any).navigateTo;
        };
    }, []);

    const handleLogin = () => {
        setIsLoggedIn(true);
        setAuthView("login");
    };

    const handleRegisterSuccess = () => {
        setIsLoggedIn(true);
        setAuthView("login");
    };

    const handleLogout = () => {
        logout();
        setIsLoggedIn(false);
        setCurrentPage("dashboard");
        setAuthView("login");
    };

    const handleNavigate = (page: string) => {
        setCurrentPage(page);
    };

    const renderPage = () => {
        switch (currentPage) {
            case "dashboard":
                return <DashboardPage />;
            case "clustering":
                return <ClusteringPage />;
            case "analytics":
                return <AnalyticsPage />;
            case "map":
                return <MapPage />;
            case "opportunities":
                return <OpportunitiesPage />;
            default:
                return <DashboardPage />;
        }
    };

    if (!isLoggedIn) {
        if (authView === "register") {
            return (
                <Register
                    onRegisterSuccess={handleRegisterSuccess}
                    onBackToLogin={() => setAuthView("login")}
                />
            );
        }

        if (authView === "forgot-password") {
            return (
                <ForgotPassword
                    onBackToLogin={() => setAuthView("login")}
                />
            );
        }

        return (
            <Login
                onLogin={handleLogin}
                onShowRegister={() => setAuthView("register")}
                onShowForgotPassword={() => setAuthView("forgot-password")}
            />
        );
    }

    return (
        <>
            <DashboardLayout
                currentPage={currentPage}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
            >
                {renderPage()}
            </DashboardLayout>
            <Toaster />
        </>
    );
}
