import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Alert, AlertDescription } from "../ui/alert";
import { Shield, ArrowLeft, Eye, EyeOff, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { validateEmail } from "../../utils/validation";
import { useKMeansStore } from "../../lib/stores/kmeansStore";

// Field error display component
function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="text-xs text-red-500 mt-1 flex items-center gap-1 animate-fadeIn">
      <AlertCircle className="w-3 h-3" />
      {error}
    </p>
  );
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 3;
const SESSION_EXPIRE_MINUTES = 20;

export function AdminLoginPage() {
  const navigate = useNavigate();

  // Input states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Lockout states
  const [isLocked, setIsLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);
  const lockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Field-level validation
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleBlur = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));

    if (field === "email") {
      const result = validateEmail(email);
      setFieldErrors(prev => ({ ...prev, email: result.error || "" }));
    } else if (field === "password") {
      if (!password) {
        setFieldErrors(prev => ({ ...prev, password: "Password is required" }));
      } else {
        setFieldErrors(prev => ({ ...prev, password: "" }));
      }
    }
  }, [email, password]);

  // -------------------------------
  // Countdown helper (defined first to be available to checkLockout)
  // -------------------------------
  const startCountdown = useCallback((unlockTime: number) => {
    if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);

    lockIntervalRef.current = setInterval(() => {
      const now = Date.now();
      if (now >= unlockTime) {
        if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
        setIsLocked(false);
        setLockCountdown(0);
        return;
      }

      setLockCountdown(Math.ceil((unlockTime - now) / 1000));
    }, 1000);
  }, []);

  // -------------------------------
  // Brute-Force Protection: Check Lockout
  // -------------------------------
  const checkLockout = useCallback(() => {
    const lockoutUntil = localStorage.getItem("admin_lockout_until");
    if (!lockoutUntil) return;

    const now = Date.now();
    const unlockTime = Number(lockoutUntil);

    if (now < unlockTime) {
      setIsLocked(true);
      const remaining = Math.ceil((unlockTime - now) / 1000);
      setLockCountdown(remaining);
      startCountdown(unlockTime);
    } else {
      localStorage.removeItem("admin_lockout_until");
      setIsLocked(false);
    }
  }, [startCountdown]);

  // -------------------------------
  // Load Remember Me Credential on Mount
  // -------------------------------
  useEffect(() => {
    const savedEmail = localStorage.getItem("admin_email");
    const savedPassword = localStorage.getItem("admin_password");

    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    if (savedPassword) setPassword(savedPassword);

    checkLockout();
  }, [checkLockout]);

  const recordFailedAttempt = () => {
    let fails = Number(localStorage.getItem("admin_failed_attempts") || 0);
    fails += 1;

    if (fails >= MAX_FAILED_ATTEMPTS) {
      const lockoutUntil = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
      localStorage.setItem("admin_lockout_until", lockoutUntil.toString());
      setIsLocked(true);
      startCountdown(lockoutUntil);
      toast.error("Too many failed attempts. Try again later.");
    }

    localStorage.setItem("admin_failed_attempts", fails.toString());
  };

  const clearFailedAttempts = () => {
    localStorage.removeItem("admin_failed_attempts");
  };

  // -------------------------------
  // SESSION EXPIRATION SYSTEM
  // -------------------------------
  const setupSessionExpiration = () => {
    const expirationTime = Date.now() + SESSION_EXPIRE_MINUTES * 60 * 1000;
    localStorage.setItem("admin_session_expire", expirationTime.toString());

    let warningShown = false;

    const interval = setInterval(() => {
      const expireAt = Number(localStorage.getItem("admin_session_expire"));
      const now = Date.now();
      const minutesRemaining = Math.ceil((expireAt - now) / 60000);

      // Show warning at 2 minutes left
      if (minutesRemaining === 2 && !warningShown) {
        toast.warning("Your session will expire in 2 minutes.");
        warningShown = true;
      }

      if (now >= expireAt) {
        clearInterval(interval);
        localStorage.removeItem("admin_session_expire");
        localStorage.removeItem("admin-session");
        // Clear K-Means session data
        useKMeansStore.getState().reset();
        supabase.auth.signOut();
        toast.error("Session expired. Please log in again.");
        navigate("/admin/login");
      }
    }, 30000);
  };

  // Reset session timer on user interaction
  useEffect(() => {
    const resetTimer = () => {
      const expireAt = Date.now() + SESSION_EXPIRE_MINUTES * 60 * 1000;
      localStorage.setItem("admin_session_expire", expireAt.toString());
    };

    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);

    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
    };
  }, []);

  // -------------------------------
  // SUBMIT LOGIN
  // -------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      toast.error("Login temporarily locked.");
      return;
    }

    // Validate fields before submission
    const errors: Record<string, string> = {};
    const emailResult = validateEmail(email);
    if (!emailResult.isValid) errors.email = emailResult.error || "";
    if (!password) errors.password = "Password is required";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setTouched({ email: true, password: true });
      const firstError = Object.values(errors)[0];
      toast.error(firstError);
      return;
    }

    setLoading(true);
    setError("");

    // 1. Authenticate user
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      recordFailedAttempt();
      setError("Invalid admin email or password");
      toast.error("Invalid admin credentials");
      setLoading(false);
      return;
    }

    clearFailedAttempts();

    const user = data.user;
    if (!user) {
      setError("Login failed.");
      setLoading(false);
      return;
    }

    // 2. Fetch role from PROFILES table instead of metadata
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Profile Fetch Error:", profileError);
      toast.error("Unable to load admin profile.");
      setLoading(false);
      return;
    }

    if (profile.role !== "admin") {
      setError("Access denied. Admins only.");
      toast.error("Unauthorized access.");
      // Clear K-Means session data
      useKMeansStore.getState().reset();
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    // 3. Update last_login
    await supabase
      .from("profiles")
      .update({ last_login: new Date().toISOString() })
      .eq("id", user.id);

    // 4. Save Remember Me
    if (rememberMe) {
      localStorage.setItem("admin_email", email);
      localStorage.setItem("admin_password", password);
      localStorage.setItem("admin-session", "true");
    } else {
      localStorage.removeItem("admin_email");
      localStorage.removeItem("admin_password");
    }

    // 5. Start session expiration timer
    setupSessionExpiration();

    toast.success("Admin login successful!");

    // 6. Redirect to Admin Dashboard
    navigate("/admin", { replace: true });

    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-purple-50/30 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-slate-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-slate-400/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fadeInUp">
        <Card className="bg-white/90 backdrop-blur-xl border-gray-100/80 shadow-2xl shadow-gray-900/10 rounded-3xl">
        <CardHeader className="space-y-4 pb-2">
          {/* Back button */}
          <button
            className="group flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors w-fit"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>

          {/* Logo */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-20 h-20 bg-slate-700 rounded-2xl shadow-lg shadow-slate-700/30 flex items-center justify-center">
              <Shield className="w-10 h-10 text-white" />
              <div className="absolute -inset-1 bg-slate-700 rounded-2xl blur opacity-30 -z-10" />
            </div>

            <div className="text-center">
              <CardTitle className="text-2xl font-bold text-gray-900">
                Admin Portal
              </CardTitle>
              <CardDescription className="text-sm text-gray-500 mt-1">
                Sign in with your administrator credentials
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {/* LOCKOUT MESSAGE */}
          {isLocked && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                Too many failed attempts. Try again in{" "}
                <b>{lockCountdown}s</b>.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: "" }));
                }}
                onBlur={() => handleBlur("email")}
                error={touched.email && !!fieldErrors.email}
                disabled={loading || isLocked}
                required
              />
              {touched.email && <FieldError error={fieldErrors.email} />}
            </div>

            {/* PASSWORD WITH SHOW/HIDE */}
            <div className="space-y-2 relative">
              <Label>Password</Label>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: "" }));
                }}
                onBlur={() => handleBlur("password")}
                error={touched.password && !!fieldErrors.password}
                disabled={loading || isLocked}
                required
              />

              <button
                type="button"
                className="absolute right-3 top-9 text-gray-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              {touched.password && <FieldError error={fieldErrors.password} />}
            </div>

            {/* REMEMBER ME */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              <Label htmlFor="remember" className="text-sm text-gray-600">
                Remember Me
              </Label>
            </div>

            <Button
              type="submit"
              variant="gradient"
              className="w-full h-12 bg-linear-to-r from-purple-600 to-fuchsia-600"
              disabled={loading || isLocked}
            >
              {loading ? "Signing in..." : "Sign In to Admin Portal"}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 pt-6 border-t border-gray-100 mt-6">
            Strategic Store Placement System © 2025
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

export default AdminLoginPage;
