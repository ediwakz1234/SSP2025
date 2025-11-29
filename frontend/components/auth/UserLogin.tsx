import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase"; 
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

export function UserLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false); // NEW
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ------------------------------------------------------------
  // 🧠 Load saved email from localStorage (if logout happened)
  // ------------------------------------------------------------
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // ------------------------------------------------------------
  // 🔥 LOGIN HANDLER
  // ------------------------------------------------------------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      // 🧠 Save or remove remembered email
      if (rememberMe) {
        localStorage.setItem("rememberEmail", email);
      } else {
        localStorage.removeItem("rememberEmail");
      }

      // Supabase Login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message || "Invalid login credentials.");
      }

      toast.success("Login Successful!");

      // Role check
      const role = data.user?.user_metadata?.role;

      if (role === "admin") navigate("/admin");
      else navigate("/user");

    } catch (err: any) {
      console.error("Login error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // UI START — No changes except adding Remember Me
  // ------------------------------------------------------------
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f8f7ff] p-4">
      <div className="w-full max-w-md bg-white text-black shadow-xl rounded-2xl p-8 space-y-6">

        {/* Back */}
        <button
          className="flex items-center text-sm text-gray-600 hover:underline"
          onClick={() => navigate("/")}
        >
          ← Back to Home
        </button>

        {/* Icon */}
        <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-black">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c-1.657 0-3 1.343-3 3v3h6v-3c0-1.657-1.343-3-3-3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 11V7a5 5 0 10-10 0v4" />
            <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
          </svg>
        </div>

        <h2 className="text-center text-2xl font-semibold">
          Strategic Store Placement
        </h2>
        <p className="text-center text-sm text-gray-500">
          Optimizing Business Location Using K-Means Clustering
        </p>

        {error && (
          <div className="p-3 bg-red-600 text-white text-sm rounded-md text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">

          {/* Email */}
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              className="bg-gray-200 text-black"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-medium">Password</label>

            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                className="bg-gray-200 text-black pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-600 hover:text-black"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button
              type="button"
              className="text-xs text-right w-full text-blue-600 hover:underline mt-1"
              onClick={() => navigate("/forgot-password")}
            >
              Forgot password?
            </button>
          </div>

          {/* ✅ REMEMBER ME CHECKBOX */}
          <div className="flex items-center gap-2 -mt-2">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={() => setRememberMe(!rememberMe)}
              className="w-4 h-4 cursor-pointer"
            />
            <label className="text-sm text-gray-700 cursor-pointer">
              Remember me
            </label>
          </div>

          {/* Sign In Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-2 rounded-md hover:bg-gray-800"
          >
            {loading ? "Signing In..." : "Sign In"}
          </Button>
        </form>

        <p className="text-center text-sm">
          Don’t have an account?{" "}
          <span
            onClick={() => navigate("/register")}
            className="text-blue-600 hover:underline cursor-pointer"
          >
            Register here
          </span>
        </p>

        <p className="text-center text-xs text-gray-400">Thesis Project © 2025</p>
      </div>
    </div>
  );
}
