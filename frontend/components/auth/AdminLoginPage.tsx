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
import { Alert, AlertDescription } from "../ui/alert";
import { Shield, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";


const API_BASE_URL = import.meta.env.VITE_API_URL;

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError("");

  // Attempt Supabase login
  const { data, error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // If credentials are wrong
  if (loginError) {
    setError("Invalid admin email or password");
    toast.error("Invalid admin credentials");
    setLoading(false);
    return;
  }

  const user = data.user;

  // Block normal users from accessing the admin panel
  if (!user || user.user_metadata.role !== "admin") {
    setError("Access denied. Admins only.");
    toast.error("Unauthorized access");
    await supabase.auth.signOut();
    setLoading(false);
    return;
  }

  // Admin authenticated successfully
  toast.success("Login successful!");
  navigate("/admin");
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-[#f7f8ff] to-[#ece8ff] p-4">
      <Card className="w-full max-w-md bg-white text-black shadow-xl rounded-2xl">
        <CardHeader className="space-y-4">
          {/* Back to Home inside card */}
          <Button
            variant="ghost"
            className="w-fit -ml-2 text-gray-600"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Home
          </Button>

          <div className="flex justify-center mt-2">
            <div className="bg-purple-100 p-4 rounded-full shadow-sm">
              <Shield className="size-12 text-purple-600" />
            </div>
          </div>

          <CardTitle className="text-center text-2xl font-semibold">
            Admin Portal
          </CardTitle>
          <CardDescription className="text-center text-gray-600">
            Sign in with your administrator credentials
          </CardDescription>
        </CardHeader>

        <CardContent>
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
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-white"
              />
            </div>

            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-white"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In to Admin Portal"}
            </Button>

            <div className="text-center text-sm text-gray-600">
              <p>Looking for the user portal?</p>
              <Button
                variant="link"
                className="text-blue-600"
                onClick={() => navigate("/user/login")}
              >
                Sign in as User
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminLoginPage;
