// 🟦 EnterCodePage.tsx (with 6-box OTP, auto-focus, resend + timer)

import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";

export function EnterCodePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const email = params.get("email")!;

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const [loading, setLoading] = useState(false);

  // TIMER
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // TIMER COUNTDOWN
  useEffect(() => {
    if (timer <= 0) {
      setCanResend(true);
      return;
    }

    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // HANDLE OTP INPUT
  const handleChange = (value: string, index: number) => {
    if (!/^[0-9]?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next box
    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    // Auto-submit when full
    if (newOtp.every((d) => d !== "")) {
      verifyCode(newOtp.join(""));
    }
  };

  // HANDLE BACKSPACE
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Backspace" && otp[index] === "" && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  // VERIFY OTP
  const verifyCode = async (finalCode: string) => {
    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: finalCode,
      type: "email",
    });

    if (error) {
      toast.error("Invalid or expired code.");
      setLoading(false);
      return;
    }

    toast.success("Code verified!");
    navigate("/reset-password-final");
  };

  // RESEND OTP
  const handleResend = async () => {
    if (!canResend) return;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (error) return toast.error(error.message);

    toast.success("New code sent!");
    setOtp(["", "", "", "", "", ""]);
    setTimer(30);
    setCanResend(false);
    inputs.current[0]?.focus();
  };

 return (
  <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
    <Card className="w-full max-w-md shadow-xl bg-white rounded-2xl">
      <CardHeader className="text-center space-y-4 pb-8">

        {/* ICON CONTAINER */}
        <div className="mx-auto w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8 text-black"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 11c1.657 0 3-1.567 3-3.5S13.657 4 12 4 9 5.567 9 7.5 10.343 11 12 11zm0 0c-3.866 0-7 2.582-7 6v1h14v-1c0-3.418-3.134-6-7-6z"
            />
          </svg>
        </div>

        <CardTitle className="text-2xl font-semibold text-black">
          Enter Verification Code
        </CardTitle>

        <p className="text-gray-600 text-sm">
          A 6-digit code was sent to <span className="font-medium">{email}</span>
        </p>

      </CardHeader>

      <CardContent>

        {/* OTP BOXES */}
        <div className="flex justify-between gap-2 mb-6">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputs.current[index] = el)}
              type="text"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(e.target.value, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className="
                w-12 h-14 bg-gray-100 text-black text-center 
                rounded-xl border border-gray-300 text-xl font-semibold
                focus:outline-none focus:ring-2 focus:ring-black transition-all
              "
            />
          ))}
        </div>

        {/* VERIFY BUTTON */}
        <Button
          className="w-full bg-black hover:bg-gray-800 text-white rounded-lg py-2"
          disabled={loading}
          onClick={() => verifyCode(otp.join(""))}
        >
          {loading ? "Verifying..." : "Verify Code"}
        </Button>

        {/* RESEND + TIMER */}
        <div className="text-center mt-4">
          {canResend ? (
            <button
              type="button"
              className="text-blue-600 underline text-sm"
              onClick={handleResend}
            >
              Resend Code
            </button>
          ) : (
            <p className="text-gray-500 text-sm">
              Resend in <span className="font-semibold">{timer}s</span>
            </p>
          )}
        </div>

        {/* CHANGE EMAIL */}
        <Button
          variant="ghost"
          className="w-full mt-6 text-black
          "
          onClick={() => navigate("/forgot-password")}
        >
          Back to Email
        </Button>

        <p className="text-center text-xs text-gray-500 mt-4 mb-2">
          Thesis Project © 2025
        </p>

      </CardContent>
    </Card>
  </div>
);}
