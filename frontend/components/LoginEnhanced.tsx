import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { MapPin, Loader2, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "../components/ui/alert";
import { toast } from "sonner";

const API_BASE_URL = "http://127.0.0.1:8000";

interface LoginProps {
    onLogin: () => void;
    onShowRegister: () => void;
    onShowForgotPassword: () => void;
}

export default function LoginEnhanced({
    onLogin,
    onShowRegister,
    onShowForgotPassword,
}: LoginProps) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!email.trim()) {
            newErrors.email = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.email = "Please enter a valid email";
        }

        if (!password) {
            newErrors.password = "Password is required";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setIsLoading(true);
        setErrors({});

        try {
            const formData = new FormData();
            formData.append("username", email.trim());
            formData.append("password", password);

            const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                const message =
                    error.detail?.includes("Incorrect") || error.detail?.includes("Unauthorized")
                        ? "Invalid email or password"
                        : error.detail || `Login failed (HTTP ${response.status})`;
                throw new Error(message);
            }

            const data = await response.json();

            // ✅ Use the same key name used in your other components
            localStorage.setItem("access_token", data.access_token);

            // ✅ Save user info safely
            if (data.user) {
                localStorage.setItem("user", JSON.stringify(data.user));
            }

            // ✅ Optional: force the app to refresh so `App.tsx` picks up the new user
            window.location.reload();

            toast.success("Login successful!");
            onLogin(); // Navigate to dashboard or next page

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Login failed";
            toast.error(errorMessage);
            setErrors({ general: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (field: string, value: string) => {
        if (errors[field]) {
            const newErrors = { ...errors };
            delete newErrors[field];
            setErrors(newErrors);
        }

        if (field === "email") setEmail(value);
        else if (field === "password") setPassword(value);
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 p-4">
            <Card className="w-full max-w-md shadow-lg rounded-2xl">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="bg-primary text-primary-foreground p-4 rounded-full">
                            <MapPin className="w-8 h-8" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-semibold">
                        Strategic Store Placement
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                        K-Means Clustering Analysis for Brgy. Sta. Cruz, Santa Maria, Bulacan
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {errors.general && (
                            <Alert variant="destructive">
                                <AlertDescription>{errors.general}</AlertDescription>
                            </Alert>
                        )}

                        {/* Email Field */}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => handleInputChange("email", e.target.value)}
                                disabled={isLoading}
                                className={`bg-input-background ${errors.email ? "border-red-500" : ""}`}
                                autoComplete="email"
                            />
                            {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                        </div>

                        {/* Password Field */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>
                                <button
                                    type="button"
                                    onClick={onShowForgotPassword}
                                    className="text-sm text-primary hover:underline"
                                    disabled={isLoading}
                                >
                                    Forgot password?
                                </button>
                            </div>

                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => handleInputChange("password", e.target.value)}
                                    disabled={isLoading}
                                    className={`bg-input-background pr-10 ${errors.password ? "border-red-500" : ""}`}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    disabled={isLoading}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
                        </div>

                        {/* Submit Button */}
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                "Sign In"
                            )}
                        </Button>

                        {/* Footer Section */}
                        <div className="text-center space-y-2">
                            <div className="text-sm text-muted-foreground">
                                SSP THESIS 2025
                            </div>
                            <div className="text-sm">
                                Don’t have an account?{" "}
                                <button
                                    type="button"
                                    onClick={onShowRegister}
                                    className="text-primary hover:underline font-medium"
                                    disabled={isLoading}
                                >
                                    Register here
                                </button>
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
