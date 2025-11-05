import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { registerAndRedirect } from "../utils/auth";

declare global {
    interface Window {
        navigateTo?: (path: string) => void;
    }
}


const API_BASE_URL = "http://127.0.0.1:8000";

export default function RegisterEnhanced({ onRegisterSuccess }: { onRegisterSuccess: () => void }) {
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        contactNumber: "",
        date_of_birth: "",
        address: "",
        age: "",
        gender: "",
    });

    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleGenderChange = (value: string) => {
        setFormData({ ...formData, gender: value });
    };



    const validateForm = () => {
        const { firstName, lastName, email, password, confirmPassword, age } = formData;

        if (!firstName || !lastName) {
            toast.error("Please enter your full name.");
            return false;
        }

        if (!email.includes("@")) {
            toast.error("Please enter a valid email address.");
            return false;
        }

        if (password.length < 8) {
            toast.error("Password must be at least 8 characters long.");
            return false;
        }

        if (password !== confirmPassword) {
            toast.error("Passwords do not match.");
            return false;
        }

        if (!age || isNaN(Number(age)) || Number(age) < 18) {
            toast.error("You must be at least 18 years old to register.");
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;
        setIsLoading(true);

        try {
            // ✅ Perform registration once
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    first_name: formData.firstName.trim(),
                    last_name: formData.lastName.trim(),
                    email: formData.email.trim(),
                    password: formData.password,
                    contact_number: formData.contactNumber.trim(),
                    address: formData.address.trim(),
                    age: parseInt(formData.age),
                    gender: formData.gender,

                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                const message =
                    error.detail?.includes("already")
                        ? "That email is already registered."
                        : error.detail || `Registration failed (HTTP ${response.status})`;
                throw new Error(message);
            }

            const data = await response.json();

            // ✅ Store token and user info
            localStorage.setItem("access_token", data.access_token);
            if (data.user) localStorage.setItem("user", JSON.stringify(data.user));

            // ✅ Toast feedback
            toast.success("🎉 Account created successfully! Redirecting to Dashboard...");

            // ✅ Redirect after short delay
            setTimeout(() => {
                if (window.navigateTo) {
                    window.navigateTo("/dashboard");
                } else {
                    window.location.href = "/dashboard";
                }
            }, 1500);
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Registration failed";
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };




    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 to-indigo-100 p-4">
            <Card className="w-full max-w-lg shadow-lg rounded-2xl">
                <CardHeader>
                    <CardTitle className="text-center text-2xl font-semibold">
                        Create Account
                    </CardTitle>
                    <p className="text-center text-sm text-muted-foreground">
                        Join the Store Placement Analysis System
                    </p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-1">
                                First Name *
                            </label>
                            <Input
                                name="firstName"
                                placeholder="First Name *"
                                value={formData.firstName}
                                onChange={handleChange}
                                disabled={isLoading}
                                required
                            />
                            <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-1">
                                Last Name *
                            </label>
                            <Input
                                name="lastName"
                                placeholder="Last Name *"
                                value={formData.lastName}
                                onChange={handleChange}
                                disabled={isLoading}
                                required
                            />
                        </div>
                        <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-1">
                            Email *
                        </label>
                        <Input
                            name="email"
                            type="email"
                            placeholder="Email Address *"
                            value={formData.email}
                            onChange={handleChange}
                            disabled={isLoading}
                            required
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-1">
                                Password *
                            </label>
                            <Input
                                name="password"
                                type="password"
                                placeholder="Password * (min. 8 characters)"
                                value={formData.password}
                                onChange={handleChange}
                                disabled={isLoading}
                                required
                            />


                            <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-1">
                                Confirm Password *
                            </label>
                            <Input
                                name="confirmPassword"
                                type="password"
                                placeholder="Confirm Password *"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                disabled={isLoading}
                                required
                            />
                        </div>
                        <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-1">
                            Contact Number*
                        </label>
                        <Input
                            name="contactNumber"
                            placeholder="Contact Number"
                            value={formData.contactNumber}
                            onChange={handleChange}
                            disabled={isLoading}
                        />
                        <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-1">
                            Address *
                        </label>
                        <Input
                            name="address"
                            placeholder="Address (Street, Barangay, City, Province)"
                            value={formData.address}
                            onChange={handleChange}
                            disabled={isLoading}
                        />

                        <label
                            htmlFor="date_of_birth"
                            className="block text-sm font-medium text-gray-700 mb-1"
                        >
                            Date of Birth *
                        </label>
                        <Input
                            name="date_of_birth"
                            type="date"
                            placeholder="Date of Birth *"
                            value={formData.date_of_birth}
                            onChange={handleChange}
                            disabled={isLoading}
                            required
                        />

                        <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-1">
                            Age *
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input
                                name="age"
                                type="number"
                                placeholder="Age *"
                                value={formData.age}
                                onChange={handleChange}
                                disabled={isLoading}
                                required
                            />
                            <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-1">
                                Gender *
                            </label>
                            <Select onValueChange={handleGenderChange} disabled={isLoading}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            type="submit"
                            className="w-full mt-4"
                            disabled={isLoading}
                        >
                            {isLoading ? "Creating Account..." : "Create Account"}
                        </Button>

                        <div className="text-center text-sm text-muted-foreground mt-2">
                            <p>
                                Already have an account?{" "}
                                <a href="/login" className="text-primary hover:underline">
                                    Sign in here
                                </a>
                            </p>

                            {/* Security Note */}
                            <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-md p-3">
                                <p>
                                    <strong>Note:</strong> Your information is encrypted and used only to register your account in the Store Placement System.
                                </p>
                            </div>

                            {/* Back Button */}
                            <div className="mt-4 flex justify-center">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => (window.location.href = "/login")}
                                    className="text-sm font-medium"
                                    disabled={isLoading}
                                >
                                    ← Back to Login
                                </Button>
                            </div>
                        </div>

                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
