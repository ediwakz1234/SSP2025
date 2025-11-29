// 🟩 ResetPasswordPage.tsx (FINAL PASSWORD SET)

import { useEffect, useState } from "react";
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
import { Lock, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";

export function ResetPasswordPage() {
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isReset, setIsReset] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        toast.error("You must verify the code first.");
        navigate("/forgot-password");
      }
    });
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPassword)) {
      toast.error("Password must be 8+ characters, include 1 uppercase and 1 number.");
      return;
    }

    if (newPassword !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset successfully!");
      setIsReset(true);
    }

    setLoading(false);
  };

  if (isReset) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-white p-4">
        <Card className="w-full max-w-md bg-white text-black shadow-xl rounded-2xl">
          <CardHeader className="text-center space-y-4 pb-8">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>

            <CardTitle className="text-2xl font-semibold">Password Reset</CardTitle>
            <CardDescription>Your password has been updated.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <Button className="w-full bg-black text-white" onClick={() => navigate("/user/login")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white p-4">
      <Card className="w-full max-w-md bg-white text-black shadow-xl rounded-2xl">
        <CardHeader className="text-center space-y-4 pb-8">
          <Button
            variant="ghost"
            className="w-fit -ml-2 text-gray-600"
            onClick={() => navigate("/user/login")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Login
          </Button>

          <div className="mx-auto w-16 h-16 bg-black rounded-2xl flex items-center justify-center">
            <Lock className="w-8 h-8 text-white" />
          </div>

          <CardTitle className="text-2xl font-semibold">
            Create New Password
          </CardTitle>

          <CardDescription>Enter and confirm your new password.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-[#DCDCDC] text-black"
                required
              />
            </div>

            <div>
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="bg-[#DCDCDC] text-black"
                required
              />
            </div>

            <Button type="submit" className="w-full bg-black text-white" disabled={loading}>
              {loading ? "Updating..." : "Reset Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
