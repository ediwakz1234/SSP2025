import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase"; 

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

const API_BASE_URL = import.meta.env.VITE_API_URL;

export function Register() {
  const navigate = useNavigate();

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
    // 1. Supabase sign-up
    const { data, error } = await supabase.auth.signUp({
      email: formData.email.trim(),
      password: formData.password,
      options: {
        data: {
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          contact_number: formData.contactNumber.trim(),
          address: formData.address.trim(),
          age: parseInt(formData.age),
          gender: formData.gender,
          date_of_birth: formData.date_of_birth,
          role: "user",

        },
      },
    });

    if (error) {
      // handle Supabase errors
      if (error.message.includes("already registered")) {
        toast.error("This email is already registered.");
      } else {
        toast.error(error.message);
      }
      return;
    }

    toast.success("Registration successful! You can now login your account!");

    // optional: navigate after sign-up
    navigate("/user/login");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Registration failed.";
    toast.error(msg);
  } finally {
    setIsLoading(false);
  }
};
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-[#f7f8ff] to-[#ece8ff] p-4">

      <Card className="w-full max-w-lg bg-white text-black shadow-xl rounded-2xl">
        
        <CardHeader>
          {/* Back button → blue link */}
          <Button
  variant="ghost"
  className="w-fit -ml-2 text-black hover:underline"
  onClick={() => navigate("/user/login")}
>
  ← Back to Login
          </Button>

          <CardTitle className="text-center text-2xl font-semibold">
            Create Account
          </CardTitle>

          <p className="text-center text-sm text-gray-600">
            Join the Store Placement Analysis System
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">First Name *</label>
                <Input
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  className="bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Last Name *</label>
                <Input
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  className="bg-white"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <Input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={isLoading}
                className="bg-white"
              />
            </div>

            {/* Passwords */}
            <div>
              <label className="block text-sm font-medium mb-1">Password *</label>
              <Input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={isLoading}
                className="bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Confirm Password *</label>
              <Input
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                disabled={isLoading}
                className="bg-white"
              />
            </div>

            {/* Contact */}
            <div>
              <label className="block text-sm font-medium mb-1">Contact Number *</label>
              <Input
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleChange}
                disabled={isLoading}
                className="bg-white"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium mb-1">Address *</label>
              <Input
                name="address"
                value={formData.address}
                onChange={handleChange}
                disabled={isLoading}
                className="bg-white"
              />
            </div>

            {/* DOB */}
            <div>
              <label className="block text-sm font-medium mb-1">Date of Birth *</label>
              <Input
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
                required
                disabled={isLoading}
                className="bg-white"
              />
            </div>

            {/* Age & Gender */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Age *</label>
             <Input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  name="age"
  value={formData.age}
  onChange={handleChange}
  required
  disabled={isLoading}
  className="bg-[#DCDCDC]"
/>

              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Gender *</label>
                <Select onValueChange={handleGenderChange} disabled={isLoading}>
                  <SelectTrigger className="text-black">
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

            {/* Submit Button (black) */}
            <Button
              type="submit"
              className="w-full bg-black text-white hover:bg-gray-900"
              disabled={isLoading}
            >
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>

            {/* Link (blue) */}
            <div className="text-center text-sm mt-3">
              Already have an account?{" "}
              <button
                type="button"
                className="text-blue-600 hover:underline"
              onClick={() => navigate("/user/login")}

              >
                Sign in here
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default Register;
