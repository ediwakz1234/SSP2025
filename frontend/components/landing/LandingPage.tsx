import { useState, useEffect } from 'react';
import { MapPin, Shield, Users, Target, BarChart3, Sparkles, ArrowRight, ChevronRight } from 'lucide-react';
import { useNavigate } from "react-router-dom";

import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../ui/card';

type PortalMode = 'user' | 'admin' | 'both';

/* Feature Item Components */
function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 group">
      <div className="w-2 h-2 rounded-full bg-[#1e3a5f] group-hover:scale-125 transition-transform" />
      <span className="text-gray-600 group-hover:text-gray-800 transition-colors">{text}</span>
    </div>
  );
}

function FeatureItemAdmin({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 group">
      <div className="w-2 h-2 rounded-full bg-slate-500 group-hover:scale-125 transition-transform" />
      <span className="text-gray-600 group-hover:text-gray-800 transition-colors">{text}</span>
    </div>
  );
}

/* Feature Card Component */
function FeatureCard({ 
  icon: Icon, 
  title, 
  description, 
  delay = "0ms" 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
  delay?: string;
}) {
  return (
    <Card 
      variant="elevated" 
      className="group animate-fadeInUp" 
      style={{ animationDelay: delay }}
    >
      <CardHeader className="pb-3">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
          <Icon className="w-7 h-7 text-[#1e3a5f]" />
        </div>
        <CardTitle className="text-xl text-gray-900">{title}</CardTitle>
        <CardDescription className="text-gray-600 leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function LandingPage() {
  const navigate = useNavigate();

  /* Secret Mode Switching Logic */
  const [portalMode, setPortalMode] = useState<PortalMode>('user');
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);

  const cyclePortalMode = () => {
    setPortalMode(prev => {
      if (prev === 'user') return 'admin';
      if (prev === 'admin') return 'both';
      return 'user';
    });
  };

  // Shift + A shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'A') {
        cyclePortalMode();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Triple-click logo
  const handleLogoClick = () => {
    const now = Date.now();

    if (now - lastClickTime > 500) {
      setLogoClickCount(1);
    } else {
      setLogoClickCount(prev => prev + 1);
    }
    setLastClickTime(now);

    if (logoClickCount >= 2) {
      cyclePortalMode();
      setLogoClickCount(0);
    }
  };

  // Hidden corner button
  const handleCornerClick = () => {
    cyclePortalMode();
  };

  const showUser = portalMode === 'user' || portalMode === 'both';
  const showAdmin = portalMode === 'admin' || portalMode === 'both';

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-indigo-50/30 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float" />
        <div className="absolute top-1/3 -left-40 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl animate-float delay-1000" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl animate-float delay-500" />
      </div>

      {/* Secret clickable corner */}
      <button
        onClick={handleCornerClick}
        className="fixed top-0 right-0 w-16 h-16 opacity-0 hover:opacity-10 transition-opacity z-50 bg-purple-500"
        aria-label="Admin toggle"
      />

      <div className="relative container mx-auto px-4 py-16">
        {/* HERO SECTION */}
        <div className="text-center max-w-4xl mx-auto mb-24 animate-fadeInUp">
          {/* Logo */}
          <div
            onClick={handleLogoClick}
            className="relative inline-flex items-center justify-center w-24 h-24 mb-8 cursor-pointer select-none group"
          >
            <div className="absolute inset-0 bg-[#1e3a5f] rounded-3xl shadow-2xl shadow-slate-900/30 group-hover:shadow-slate-900/40 transition-shadow" />
            <div className="absolute inset-0 bg-[#1e3a5f] rounded-3xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity" />
            <MapPin className="relative w-12 h-12 text-white group-hover:scale-110 transition-transform" />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 border border-slate-200 mb-6 animate-fadeIn delay-100">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium text-slate-700">AI-Powered Analytics</span>
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 tracking-tight animate-fadeIn delay-150">
            Strategic Store
            <span className="block text-slate-600">
              Placement System
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl text-gray-600 mb-2 animate-fadeIn delay-200">
            Optimizing Business Location Using K-Means Clustering
          </p>

          <p className="text-lg text-gray-500 animate-fadeIn delay-200">
            Brgy. Sta. Cruz, Santa Maria, Bulacan
          </p>

          <p className="text-sm text-gray-400 mt-6 max-w-lg mx-auto animate-fadeIn delay-300">
            A comprehensive business analytics platform leveraging real field survey data 
            and machine learning for optimal store placement decisions.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 animate-fadeInUp delay-500">
            <Button
              size="xl"
              variant="gradient"
              className="group"
              onClick={() => navigate("/user/login")}
            >
              Get Started
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="group"
              onClick={() => navigate("/register")}
            >
              Create Account
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </div>

        {/* FEATURE CARDS */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-24">
          <FeatureCard
            icon={Target}
            title="K-Means Clustering"
            description="Advanced clustering algorithm using the Haversine formula for precise geographic analysis and optimal location grouping."
            delay="100ms"
          />
          <FeatureCard
            icon={BarChart3}
            title="Real-Time Analytics"
            description="Interactive map visualization & comprehensive competitor analysis for data-driven business decisions."
            delay="200ms"
          />
        </div>

        {/* PORTAL CARDS */}
        <div className={`grid gap-8 max-w-4xl mx-auto ${showUser && showAdmin ? 'md:grid-cols-2' : 'md:grid-cols-1 justify-items-center'}`}>

          {/* USER PORTAL */}
          {showUser && (
            <Card 
              variant="elevated" 
              className="w-full max-w-md animate-fadeInUp"
              style={{ animationDelay: '300ms' }}
            >
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-18 h-18 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 shadow-lg shadow-slate-200">
                  <Users className="w-9 h-9 text-[#1e3a5f]" />
                </div>

                <CardTitle className="text-2xl text-gray-900">User Portal</CardTitle>
                <CardDescription className="text-gray-600">
                  Access clustering results & business recommendations
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="space-y-3 text-sm">
                  <FeatureItem text="K-Means Cluster Analysis" />
                  <FeatureItem text="Interactive Map Visualization" />
                  <FeatureItem text="Business Opportunities" />
                  <FeatureItem text="Analytics Dashboard" />
                  <FeatureItem text="Personal Profile" />
                </div>

                <Button
                  className="w-full mt-4"
                  size="lg"
                  variant="gradient"
                  onClick={() => navigate("/user/login")}
                >
                  Access User Portal
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ADMIN PORTAL */}
          {showAdmin && (
            <Card 
              variant="elevated" 
              className="w-full max-w-md animate-fadeInUp"
              style={{ animationDelay: '400ms' }}
            >
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-18 h-18 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 shadow-lg shadow-slate-200">
                  <Shield className="w-9 h-9 text-slate-600" />
                </div>

                <CardTitle className="text-2xl text-gray-900">Admin Portal</CardTitle>
                <CardDescription className="text-gray-600">
                  Manage users, logs, analytics & seed data
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="space-y-3 text-sm">
                  <FeatureItemAdmin text="System Dashboard" />
                  <FeatureItemAdmin text="User Management" />
                  <FeatureItemAdmin text="Activity Logs" />
                  <FeatureItemAdmin text="Analytics Overview" />
                  <FeatureItemAdmin text="Seed Data Management" />
                </div>

                <Button
                  className="w-full mt-4 bg-slate-600 hover:bg-slate-700 shadow-slate-500/25"
                  size="lg"
                  onClick={() => navigate("/admin/login")}
                >
                  Access Admin Portal
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* CTA Section */}
        <div className="text-center mt-28 animate-fadeInUp" style={{ animationDelay: '500ms' }}>
          <div className="inline-flex flex-col items-center p-8 rounded-3xl bg-linear-to-br from-gray-50 to-white border border-gray-100 shadow-xl shadow-gray-900/5">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Ready to find the perfect location?
            </h3>
            <p className="text-gray-500 mb-6 max-w-md">
              Start analyzing business opportunities in Sta. Cruz, Santa Maria, Bulacan today.
            </p>

            <Button
              size="lg"
              variant="gradient"
              className="group"
              onClick={() => navigate("/user/login")}
            >
              Get Started Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>

        {/* Mode Hint */}
        {portalMode !== 'user' && (
          <div className="text-center mt-8 animate-fadeIn">
            <p className="text-sm text-gray-400">
              Mode: {portalMode === 'admin' ? 'Admin Only' : 'Both Portals'} • Press Shift+A or triple-click logo to cycle
            </p>
          </div>
        )}

        {/* FOOTER */}
        <footer className="text-center mt-24 pt-8 border-t border-gray-100">
          <p className="text-sm text-gray-500 font-medium">
            Strategic Store Placement System
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Thesis Project © 2025 • Brgy. Sta. Cruz, Santa Maria, Bulacan
          </p>
        </footer>
      </div>
    </div>
  );
}

export default LandingPage;
