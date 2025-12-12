import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { ArrowLeft, MapPin, User, Mail, Lock, Phone, MapPinned, Calendar, Users, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  validateText,
  validateAddress,
} from "../../utils/validation";

// Field error display component
function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="text-xs text-red-500 mt-1 flex items-center gap-1 animate-fadeIn">
      <AlertCircle className="w-3 h-3" />
      {error}
    </p>
  );
}

// Field success indicator
function FieldSuccess({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500 animate-fadeIn" />
  );
}

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
    gender: "",
    date_of_birth: "",
  });

  // Track if address is flagged (outside target location)
  const [addressFlagged, setAddressFlagged] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  // Track touched fields for inline validation
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Field-level errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Clear error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleBlur = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));

    // Validate on blur
    let error = "";
    switch (field) {
      case "firstName": {
        const fnResult = validateText(formData.firstName, "First name", { required: true, minLength: 2 });
        error = fnResult.error || "";
        break;
      }
      case "lastName": {
        const lnResult = validateText(formData.lastName, "Last name", { required: true, minLength: 2 });
        error = lnResult.error || "";
        break;
      }
      case "email": {
        const emailResult = validateEmail(formData.email);
        error = emailResult.error || "";
        break;
      }
      case "password": {
        const pwResult = validatePassword(formData.password, { minLength: 8, requireUppercase: true, requireNumber: true });
        error = pwResult.error || "";
        break;
      }
      case "confirmPassword": {
        const cpResult = validatePasswordMatch(formData.password, formData.confirmPassword);
        error = cpResult.error || "";
        break;
      }
      case "address": {
        const addrResult = validateAddress(formData.address);
        error = addrResult.error || "";
        setAddressFlagged(addrResult.isFlagged || false);
        break;
      }
    }

    setFieldErrors(prev => ({ ...prev, [field]: error }));
  }, [formData]);

  const handleGenderChange = (value: string) => {
    setFormData({ ...formData, gender: value });
    setTouched(prev => ({ ...prev, gender: true }));
    if (fieldErrors.gender) {
      setFieldErrors(prev => ({ ...prev, gender: "" }));
    }
  };

  const isFieldValid = (field: string): boolean => {
    return touched[field] && !fieldErrors[field] && !!formData[field as keyof typeof formData];
  };

  const validateForm = () => {
    const { firstName, lastName, email, password, confirmPassword, address, gender } = formData;
    const errors: Record<string, string> = {};

    // Validate all fields
    const fnResult = validateText(firstName, "First name", { required: true, minLength: 2 });
    if (!fnResult.isValid) errors.firstName = fnResult.error || "";

    const lnResult = validateText(lastName, "Last name", { required: true, minLength: 2 });
    if (!lnResult.isValid) errors.lastName = lnResult.error || "";

    const emailResult = validateEmail(email);
    if (!emailResult.isValid) errors.email = emailResult.error || "";

    const pwResult = validatePassword(password, { minLength: 8, requireUppercase: true, requireNumber: true });
    if (!pwResult.isValid) errors.password = pwResult.error || "";

    const cpResult = validatePasswordMatch(password, confirmPassword);
    if (!cpResult.isValid) errors.confirmPassword = cpResult.error || "";

    const addrResult = validateAddress(address);
    if (!addrResult.isValid) errors.address = addrResult.error || "";
    setAddressFlagged(addrResult.isFlagged || false);

    if (!gender) errors.gender = "Please select your gender";

    // Update field errors
    setFieldErrors(errors);

    // Mark all fields as touched
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      password: true,
      confirmPassword: true,
      address: true,
      gender: true,
    });

    if (Object.keys(errors).length > 0) {
      // Show first error as toast
      const firstError = Object.values(errors)[0];
      toast.error(firstError);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName.trim(),
            last_name: formData.lastName.trim(),
            full_name: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
            contact_number: formData.contactNumber.trim(),
            address: formData.address.trim(),
            gender: formData.gender,
            date_of_birth: formData.date_of_birth,
            role: "user",
            address_flagged: addressFlagged,
          },
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      const user = data.user;

      if (!user) {
        toast.error("Sign-up failed: No user returned.");
        return;
      }

      if (addressFlagged) {
        toast.warning("Registration submitted. Your account is temporarily blocked. We are running additional checks.");
      } else {
        toast.success("Registration successful! Your account is pending approval.");
      }
      navigate("/user/login");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-indigo-50/30 p-4 py-8">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg animate-fadeInUp">
        <Card className="bg-white/90 backdrop-blur-xl border-gray-100/80 shadow-2xl shadow-gray-900/10 rounded-3xl">
          <CardHeader className="space-y-4 pb-2">
            {/* Back button */}
            <button
              className="group flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors w-fit"
              onClick={() => navigate("/user/login")}
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to Login
            </button>

            {/* Logo */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-16 h-16 bg-[#1e3a5f] rounded-2xl shadow-lg shadow-slate-900/25 flex items-center justify-center">
                <MapPin className="w-8 h-8 text-white" />
                <div className="absolute -inset-1 bg-[#1e3a5f] rounded-2xl blur opacity-30 -z-10" />
              </div>

              <div className="text-center">
                <CardTitle className="text-2xl font-bold text-gray-900">
                  Create Account
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Join the Store Placement Analysis System
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-2">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">First Name *</label>
                  <div className="relative">
                    <Input
                      name="firstName"
                      icon={<User className="w-5 h-5" />}
                      placeholder="John"
                      value={formData.firstName}
                      onChange={handleChange}
                      onBlur={() => handleBlur("firstName")}
                      error={!!fieldErrors.firstName}
                      disabled={isLoading}
                    />
                    <FieldSuccess show={isFieldValid("firstName")} />
                  </div>
                  <FieldError error={fieldErrors.firstName} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Last Name *</label>
                  <div className="relative">
                    <Input
                      name="lastName"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={handleChange}
                      onBlur={() => handleBlur("lastName")}
                      error={!!fieldErrors.lastName}
                      disabled={isLoading}
                    />
                    <FieldSuccess show={isFieldValid("lastName")} />
                  </div>
                  <FieldError error={fieldErrors.lastName} />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Email *</label>
                <div className="relative">
                  <Input
                    name="email"
                    type="email"
                    icon={<Mail className="w-5 h-5" />}
                    placeholder="john.doe@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={() => handleBlur("email")}
                    error={!!fieldErrors.email}
                    disabled={isLoading}
                  />
                  <FieldSuccess show={isFieldValid("email")} />
                </div>
                <FieldError error={fieldErrors.email} />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Password *</label>
                <div className="relative">
                  <Input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    icon={<Lock className="w-5 h-5" />}
                    placeholder="Minimum 8 characters"
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={() => handleBlur("password")}
                    error={!!fieldErrors.password}
                    disabled={isLoading}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                  <FieldSuccess show={isFieldValid("password")} />
                </div>
                <FieldError error={fieldErrors.password} />
                {!fieldErrors.password && formData.password && (
                  <p className="text-xs text-gray-400">Must include uppercase letter and number</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Confirm Password *</label>
                <div className="relative">
                  <Input
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    icon={<Lock className="w-5 h-5" />}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onBlur={() => handleBlur("confirmPassword")}
                    error={!!fieldErrors.confirmPassword}
                    disabled={isLoading}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                  <FieldSuccess show={isFieldValid("confirmPassword")} />
                </div>
                <FieldError error={fieldErrors.confirmPassword} />
              </div>

              {/* Contact & Address */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Contact Number</label>
                <Input
                  name="contactNumber"
                  icon={<Phone className="w-5 h-5" />}
                  placeholder="+63 XXX XXX XXXX"
                  value={formData.contactNumber}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Address *</label>
                <div className="relative">
                  <Input
                    name="address"
                    icon={<MapPinned className="w-5 h-5" />}
                    placeholder="e.g. Sta. Cruz, Santa Maria, Bulacan"
                    value={formData.address}
                    onChange={handleChange}
                    onBlur={() => handleBlur("address")}
                    error={!!fieldErrors.address}
                    disabled={isLoading}
                  />
                  <FieldSuccess show={isFieldValid("address") && !addressFlagged} />
                </div>
                <FieldError error={fieldErrors.address} />
                {addressFlagged && touched.address && !fieldErrors.address && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    This address is outside Sta. Cruz, Santa Maria, Bulacan. Additional verification required.
                  </p>
                )}
              </div>

              {/* DOB */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Date of Birth *</label>
                <Input
                  type="date"
                  name="date_of_birth"
                  icon={<Calendar className="w-5 h-5" />}
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              {/* Gender Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Gender *</label>
                <Select onValueChange={handleGenderChange} disabled={isLoading}>
                  <SelectTrigger className={`w-full h-11 rounded-xl border-input bg-white/80 hover:border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 ${fieldErrors.gender ? 'border-red-500' : ''}`}>
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-muted-foreground" />
                      <SelectValue placeholder="Select Gender" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError error={fieldErrors.gender} />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                loading={isLoading}
                className="w-full h-12"
                variant="gradient"
                size="lg"
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>

              {/* Login Link */}
              <div className="text-center pt-2">
                <p className="text-sm text-gray-500">
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="text-primary font-semibold hover:text-primary/80 transition-colors"
                    onClick={() => navigate("/user/login")}
                  >
                    Sign in here
                  </button>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Register;
