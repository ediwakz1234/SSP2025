import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const API_BASE_URL = "http://127.0.0.1:8000";

interface RegisterProps {
    onRegisterSuccess: () => void;
    onBackToLogin: () => void;
}

export function Register({ onRegisterSuccess, onBackToLogin }: RegisterProps) {
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        contactNumber: "",
        address: "",
        age: "",
        gender: "",
        date_of_birth: "",
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
                    date_of_birth: formData.date_of_birth,
                }),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                const message =
                    error.detail?.includes("already")
                        ? "This email is already registered."
                        : error.detail || "Registration failed.";
                throw new Error(message);
            }

            const data = await response.json();
            localStorage.setItem("token", data.access_token);
            if (data.user) localStorage.setItem("user", JSON.stringify(data.user));

            toast.success("Registration successful!");
            onRegisterSuccess();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Registration failed.";
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
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* First and Last Name */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
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
                            </div>
                            <div>
                                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
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
                        </div>

                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
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
                        </div>

                        {/* Passwords */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
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
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
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

                        {/* Contact Number */}
                        <div>
                            <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700 mb-1">
                                Contact Number *
                            </label>
                            <Input
                                name="contactNumber"
                                placeholder="Contact Number"
                                value={formData.contactNumber}
                                onChange={handleChange}
                                disabled={isLoading}
                            />
                        </div>

                        {/* Address */}
                        <div>
                            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                                Address *
                            </label>
                            <Input
                                name="address"
                                placeholder="Address (Street, Barangay, City, Province)"
                                value={formData.address}
                                onChange={handleChange}
                                disabled={isLoading}
                            />
                        </div>

                        {/* Date of Birth */}
                        <div>
                            <label htmlFor="date_of_birth" className="block text-sm font-medium text-gray-700 mb-1">
                                Date of Birth *
                            </label>
                            <Input
                                name="date_of_birth"
                                type="date"
                                placeholder="mm/dd/yyyy"
                                value={formData.date_of_birth}
                                onChange={handleChange}
                                disabled={isLoading}
                                required
                            />
                        </div>

                        {/* Age and Gender */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="age" className="block text-sm font-medium text-gray-700 mb-1">
                                    Age *
                                </label>
                                <Input
                                    name="age"
                                    type="number"
                                    placeholder="Age *"
                                    value={formData.age}
                                    onChange={handleChange}
                                    disabled={isLoading}
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
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
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            className="w-full mt-2"
                            disabled={isLoading}
                        >
                            {isLoading ? "Creating Account..." : "Create Account"}
                        </Button>

                        {/* Footer */}
                        <div className="text-center text-sm text-muted-foreground mt-3">
                            <p>
                                Already have an account?{" "}
                                <a href="/login" className="text-primary hover:underline">
                                    Sign in here
                                </a>
                            </p>

                            <div className="mt-4 bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-md p-3">
                                <p>
                                    <strong>Note:</strong> Your information is encrypted and used only to register your account in the Store Placement System.
                                </p>
                            </div>

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
