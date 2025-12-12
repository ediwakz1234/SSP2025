import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase"; 
import { toast } from "sonner";
import { Eye, EyeOff, MapPin, ArrowLeft, Mail, Lock, AlertCircle } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { validateEmail } from "../../utils/validation";

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

export function UserLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Field-level errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Load saved email from localStorage
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

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

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    const emailResult = validateEmail(email);
    if (!emailResult.isValid) errors.email = emailResult.error || "";
    
    if (!password) errors.password = "Password is required";

    setFieldErrors(errors);
    setTouched({ email: true, password: true });

    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      toast.error(firstError);
      return false;
    }
    return true;
  };

  // Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setError("");
    setLoading(true);

    try {
      if (rememberMe) {
        localStorage.setItem("rememberEmail", email);
      } else {
        localStorage.removeItem("rememberEmail");
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw new Error(error.message || "Invalid login credentials.");

      const user = data.user;
      if (!user) throw new Error("Login failed: no user returned.");

      toast.success("Login Successful!");

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileErr) {
        console.error("Profile fetch error:", profileErr);
        throw new Error("Unable to load user profile.");
      }

      const userRole = profile?.role;

      await supabase.from("profiles")
        .update({ last_login: new Date().toISOString() })
        .eq("id", user.id);

      if (userRole === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/user/dashboard", { replace: true });
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      console.error("Login error:", message);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-indigo-50/30 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fadeInUp">
        {/* Card */}
        <div className="bg-white/90 backdrop-blur-xl border border-gray-100/80 shadow-2xl shadow-gray-900/10 rounded-3xl p-8 space-y-6">

          {/* Back Button */}
          <button
            className="group flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>

          {/* Logo & Header */}
          <div className="text-center space-y-4">
            <div className="relative mx-auto w-20 h-20 bg-[#1e3a5f] rounded-2xl shadow-lg shadow-slate-900/25 flex items-center justify-center">
              <MapPin className="w-10 h-10 text-white" />
              <div className="absolute -inset-1 bg-[#1e3a5f] rounded-2xl blur opacity-30 -z-10" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Welcome Back
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Strategic Store Placement System
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl flex items-center gap-3 animate-fadeIn">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <span className="text-red-500 text-lg">!</span>
              </div>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input
                type="email"
                icon={<Mail className="w-5 h-5" />}
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: "" }));
                }}
                onBlur={() => handleBlur("email")}
                error={!!fieldErrors.email && touched.email}
              />
              {touched.email && <FieldError error={fieldErrors.email} />}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  icon={<Lock className="w-5 h-5" />}
                  placeholder="Enter your password"
                  className="pr-12"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: "" }));
                  }}
                  onBlur={() => handleBlur("password")}
                  error={!!fieldErrors.password && touched.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {touched.password && <FieldError error={fieldErrors.password} />}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={() => setRememberMe(!rememberMe)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/50 cursor-pointer"
                />
                <span className="text-gray-600 group-hover:text-gray-800 transition-colors">
                  Remember me
                </span>
              </label>
              <button
                type="button"
                className="text-[#1e3a5f] hover:text-slate-700 font-medium transition-colors"
                onClick={() => navigate("/forgot-password")}
              >
                Forgot password?
              </button>
            </div>

            {/* Sign In Button */}
            <Button
              type="submit"
              loading={loading}
              className="w-full h-12"
              variant="gradient"
              size="lg"
            >
              {loading ? "Signing In..." : "Sign In"}
            </Button>
          </form>

          {/* Register Link */}
          <div className="text-center">
            <p className="text-sm text-gray-500">
              Don't have an account?{" "}
              <button
                onClick={() => navigate("/register")}
                className="text-[#1e3a5f] font-semibold hover:text-slate-700 transition-colors"
              >
                Create Account
              </button>
            </p>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 pt-4 border-t border-gray-100">
            Strategic Store Placement System © 2025
          </p>
        </div>
      </div>
    </div>
  );
}
