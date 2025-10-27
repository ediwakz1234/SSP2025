import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { MapPin, Loader2 } from "lucide-react";
import { login } from "../utils/auth";
import { Alert, AlertDescription } from "./ui/alert";

interface LoginProps {
    onLogin: () => void;
    onShowRegister: () => void;
    onShowForgotPassword: () => void;
}

export function Login({ onLogin, onShowRegister, onShowForgotPassword }: LoginProps) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!email || !password) {
            setError("Please enter both email and password");
            return;
        }

        setIsLoading(true);

        try {
            await login(email, password);
            onLogin();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="bg-primary text-primary-foreground p-4 rounded-full">
                            <MapPin className="w-8 h-8" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl">Strategic Store Placement</CardTitle>
                    <CardDescription>
                        K-Means Clustering Analysis for Brgy. Sta. Cruz, Santa Maria, Bulacan
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                                className="bg-input-background"
                            />
                        </div>
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
                            <Input
                                id="password"
                                type="password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isLoading}
                                className="bg-input-background"
                            />
                        </div>
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
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
                        <div className="text-center space-y-2">
                            <div className="text-sm text-muted-foreground">
                                Demo: admin@example.com / admin
                            </div>
                            <div className="text-sm">
                                Don't have an account?{" "}
                                <button
                                    type="button"
                                    onClick={onShowRegister}
                                    className="text-primary hover:underline"
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
