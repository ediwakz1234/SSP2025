
import { useState } from "react";
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

import { MapPin, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";

export function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  function validateEmail(email: string) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    // 🟩 CHECK USER EXISTS (your RPC)
    const { data: userCheck } = await supabase.rpc("check_user_exists", {
      email_to_check: email,
    });

    if (!userCheck?.exists) {
      toast.error("This email is not registered.");
      setLoading(false);
      return;
    }

    // 🟩 SEND OTP INSTEAD OF RESET LINK
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("A 6-digit verification code has been sent to your email.");
    navigate(`/enter-code?email=${email}`);
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl bg-white">
        <CardHeader className="space-y-6 text-center pb-8">
          <div className="mx-auto w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center">
            <MapPin className="w-8 h-8 text-black" />
          </div>

          <div>
            <CardTitle className="text-2xl font-semibold text-black">
              Reset Password
            </CardTitle>

            <CardDescription className="text-base mt-2 text-gray-600">
              Enter your email to receive a 6-digit verification code
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />

                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-gray-100 text-black"
                  required
                />
              </div>

              <p className="text-xs text-gray-500">
                We'll send you a 6-digit code to verify your identity
              </p>
            </div>

            <Button
              type="submit"
              className="w-full mt-6 bg-black hover:bg-gray-800 text-white"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Code"}
            </Button>
          </form>

          <Button
            variant="ghost"
            className="w-full mt-6 text-black"
            onClick={() => navigate("/user/login")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Login
          </Button>

          <p className="text-center text-xs text-gray-500 mt-6">
            Thesis Project © 2025
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
