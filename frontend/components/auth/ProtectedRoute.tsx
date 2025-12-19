import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../../lib/supabase";
import {
  Clock,
  AlertTriangle,
  XCircle,
  LogOut,
  MapPin,
  Shield,
  Mail,
  RefreshCw,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { Button } from "../ui/button";
import { useKMeansStore } from "../../lib/stores/kmeansStore";

type ApprovalStatus = "pending" | "approved" | "declined" | "flagged" | null;

// ============================================================================
// PREMIUM STATUS PAGE COMPONENT
// ============================================================================
function StatusPage({
  status,
  icon: Icon,
  _iconColor,
  bgGradient,
  glowColor,
  title,
  message,
  submessage,
  features
}: {
  status: "pending" | "flagged" | "declined";
  icon: React.ElementType;
  _iconColor: string;
  bgGradient: string;
  glowColor: string;
  title: string;
  message: string;
  submessage?: string;
  features?: { icon: React.ElementType; text: string }[];
}) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    // Clear K-Means session data before logout
    useKMeansStore.getState().reset();
    await supabase.auth.signOut();
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-1/4 left-1/4 w-96 h-96 ${glowColor} rounded-full blur-3xl opacity-20 animate-pulse`} />
        <div className={`absolute bottom-1/4 right-1/4 w-80 h-80 ${glowColor} rounded-full blur-3xl opacity-15 animate-pulse`} style={{ animationDelay: "1s" }} />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Floating Particles */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      {/* Main Card */}
      <div className="relative w-full max-w-lg animate-fadeInUp">
        {/* Glass Card */}
        <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Decorative Top Border */}
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 ${bgGradient} rounded-full blur-sm`} />

          {/* Icon Container */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              {/* Glow Effect */}
              <div className={`absolute inset-0 ${bgGradient} rounded-3xl blur-xl opacity-50 scale-150 animate-pulse`} />

              {/* Main Icon Box */}
              <div className={`relative w-24 h-24 ${bgGradient} rounded-3xl flex items-center justify-center shadow-2xl`}>
                <Icon className={`w-12 h-12 text-white drop-shadow-lg`} />
              </div>

              {/* Status Badge */}
              <div className={`absolute -bottom-2 -right-2 w-8 h-8 ${status === "pending" ? "bg-amber-500" :
                status === "flagged" ? "bg-orange-500" : "bg-red-500"
                } rounded-full flex items-center justify-center border-4 border-slate-900`}>
                {status === "pending" ? (
                  <Clock className="w-4 h-4 text-white" />
                ) : status === "flagged" ? (
                  <AlertTriangle className="w-4 h-4 text-white" />
                ) : (
                  <XCircle className="w-4 h-4 text-white" />
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-white tracking-tight">
              {title}
            </h1>

            <p className="text-lg text-white/70 leading-relaxed">
              {message}
            </p>

            {submessage && (
              <p className="text-sm text-white/50 leading-relaxed max-w-sm mx-auto">
                {submessage}
              </p>
            )}
          </div>

          {/* Features List */}
          {features && features.length > 0 && (
            <div className="mt-8 space-y-3">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                >
                  <div className={`w-8 h-8 rounded-lg ${bgGradient} flex items-center justify-center`}>
                    <feature.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white/80 text-sm">{feature.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleRefresh}
              className="flex-1 h-12 bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white rounded-xl transition-all"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Status
            </Button>

            <Button
              variant="outline"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex-1 h-12 bg-white/5 border-white/10 text-white hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300 rounded-xl transition-all"
            >
              {isLoggingOut ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4 mr-2" />
              )}
              Sign Out
            </Button>
          </div>

          {/* Contact Support */}
          <div className="mt-6 pt-6 border-t border-white/5">
            <p className="text-center text-sm text-white/40">
              Need help?{" "}
              <a
                href="mailto:support@example.com"
                className="text-white/60 hover:text-white underline underline-offset-2 transition-colors"
              >
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.2; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 0.5; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-fadeInUp { animation: fadeInUp 0.6s ease-out forwards; }
      `}</style>
    </div>
  );
}

// ============================================================================
// PREMIUM LOADING COMPONENT
// ============================================================================
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/3 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "0.5s" }} />
      </div>

      <div className="relative flex flex-col items-center gap-6">
        {/* Spinner */}
        <div className="relative">
          <div className="w-16 h-16 border-4 border-white/10 rounded-full" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-primary rounded-full animate-spin" />
          <div className="absolute inset-2 w-12 h-12 border-4 border-transparent border-t-purple-500 rounded-full animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <p className="text-white font-medium">Checking your session...</p>
          <p className="text-white/50 text-sm">Please wait a moment</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PROTECTED ROUTE COMPONENT
// ============================================================================
export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) {
      setChecking(false);
      return;
    }

    async function checkApproval() {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("approval_status")
          .eq("id", user!.id)
          .single();

        if (error) {
          console.error("Error checking approval status:", error);
          setApprovalStatus("pending");
        } else {
          setApprovalStatus(data?.approval_status as ApprovalStatus ?? "pending");
        }
      } catch (err) {
        console.error("Error checking approval:", err);
        setApprovalStatus("pending");
      }
      setChecking(false);
    }

    checkApproval();
  }, [user]);

  // ⏳ Loading state
  if (loading || checking) {
    return <LoadingScreen />;
  }

  // ❌ No valid user → go to login
  if (!user) return <Navigate to="/user/login" replace />;

  // ⏳ Pending approval
  if (approvalStatus === "pending") {
    return (
      <StatusPage
        status="pending"
        icon={Clock}
        _iconColor="text-white"
        bgGradient="bg-gradient-to-br from-amber-500 to-orange-600"
        glowColor="bg-amber-500"
        title="Awaiting Approval"
        message="Your registration is being reviewed by our administrators."
        submessage="You'll receive access once your account is approved. This typically takes 1-2 business days."
        features={[
          { icon: Shield, text: "Your data is secure during the review process" },
          { icon: Mail, text: "You'll be notified once approved" },
          { icon: CheckCircle2, text: "Refresh to check your status" }
        ]}
      />
    );
  }

  // 🚩 Flagged (outside location)
  if (approvalStatus === "flagged") {
    return (
      <StatusPage
        status="flagged"
        icon={MapPin}
        _iconColor="text-white"
        bgGradient="bg-gradient-to-br from-orange-500 to-red-600"
        glowColor="bg-orange-500"
        title="Location Under Review"
        message="Your account is temporarily blocked. We are running additional checks."
        submessage="Your address appears to be outside our service area (Sta. Cruz, Santa Maria, Bulacan). An administrator will review your account manually."
        features={[
          { icon: AlertTriangle, text: "Address verification in progress" },
          { icon: Shield, text: "Manual review by administrator" },
          { icon: Mail, text: "Contact support for faster processing" }
        ]}
      />
    );
  }

  // ❌ Declined
  if (approvalStatus === "declined") {
    return (
      <StatusPage
        status="declined"
        icon={XCircle}
        _iconColor="text-white"
        bgGradient="bg-gradient-to-br from-red-500 to-rose-700"
        glowColor="bg-red-500"
        title="Application Declined"
        message="Unfortunately, your account request has been declined."
        submessage="If you believe this is an error or have updated information, please contact our support team."
        features={[
          { icon: Mail, text: "Contact support to appeal this decision" },
          { icon: Sparkles, text: "You may reapply with correct information" }
        ]}
      />
    );
  }

  // ✅ Approved
  return children;
}
