import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";

import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Separator } from "../ui/separator";
import { Progress } from "../ui/progress";
import { useActivity, logActivity } from "../../utils/activity";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select";

import {
  Mail,
  Calendar,
  Pencil,
  Save,
  X,
  Loader2,
  User,
  Phone,
  MapPin,
  Shield,
  CheckCircle,
  Sparkles
} from "lucide-react";

interface ProfileData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  gender: string;
  contactNumber: string;
  address: string;
  createdAt: string;
  lastUpdated?: string;
}

export function Profile() {
  useActivity(); // logs "Viewed Profile Page"

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    contactNumber: "",
    address: "",
  });

  const [errors, setErrors] = useState({
    firstName: "",
    lastName: "",
    contactNumber: "",
  });

  // ----------------------------------------------------
  // LOAD PROFILE
  // ----------------------------------------------------
  const loadProfile = async () => {
    try {
      setLoading(true);

      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      const u = data.user;

      const p: ProfileData = {
        id: u.id,
        email: u.email ?? "",
        firstName: u.user_metadata.first_name || "",
        lastName: u.user_metadata.last_name || "",
        gender: u.user_metadata.gender || "",
        contactNumber: u.user_metadata.contact_number || "",
        address: u.user_metadata.address || "",
        createdAt: u.created_at,
        lastUpdated: u.user_metadata.last_updated || "",
      };

      setProfile(p);

      setFormData({
        firstName: p.firstName,
        lastName: p.lastName,
        gender: p.gender,
        contactNumber: p.contactNumber,
        address: p.address,
      });
    } catch {
      toast.error("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    logActivity("Viewed Profile Page");
    loadProfile();
  }, []);

  // ----------------------------------------------------
  // HELPERS
  // ----------------------------------------------------
  const capitalize = (str: string) =>
    str
      .trim()
      .replace(/\s+/g, " ")
      .replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());

  const cleanPhone = (str: string) => str.replace(/\s+/g, " ").trim();

  const formatGender = (g: string) => (g ? g.charAt(0).toUpperCase() + g.slice(1) : "");

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  // ----------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------
  const validateForm = () => {
    const newErrors = { firstName: "", lastName: "", contactNumber: "" };
    let valid = true;

    if (!formData.firstName.trim()) {
      newErrors.firstName = "Required";
      valid = false;
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Required";
      valid = false;
    }
    if (formData.contactNumber && !/^\+?[\d\s\-()]{7,20}$/.test(formData.contactNumber)) {
      newErrors.contactNumber = "Invalid phone number";
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  // ----------------------------------------------------
  // SAVE PROFILE
  // ----------------------------------------------------
  const handleSave = async () => {
    if (!validateForm()) return;

    logActivity("Attempted to Save Profile");

    try {
      setSaving(true);

      const now = new Date().toISOString();

      const updates = {
        data: {
          first_name: capitalize(formData.firstName),
          last_name: capitalize(formData.lastName),
          gender: formData.gender,
          contact_number: cleanPhone(formData.contactNumber),
          address: formData.address.trim(),
          last_updated: now,
        },
      };

      const { error } = await supabase.auth.updateUser(updates);

      if (error) {
        toast.error(error.message);
        logActivity("Profile Update Failed", { error: error.message });
        return;
      }

      toast.success("Profile updated!");

      logActivity("Saved Profile", {
        firstName: formData.firstName,
        lastName: formData.lastName,
        gender: formData.gender,
        contactNumber: formData.contactNumber,
        address: formData.address,
      });

      setEditing(false);
      loadProfile();
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------
  // COMPLETION %
  // ----------------------------------------------------
  const completionPercentage = (() => {
    if (!profile) return 0;

    const fields = [
      profile.firstName,
      profile.lastName,
      profile.gender,
      profile.contactNumber,
      profile.address,
    ];

    const filled = fields.filter((f) => f && f !== "").length;
    return Math.round((filled / fields.length) * 100);
  })();

  const editClass = editing ? "ring-2 ring-indigo-300 shadow-md bg-white border-indigo-200" : "bg-gray-50 border-gray-200";

  // ---------------------------
  // LOADING SCREEN
  // ---------------------------
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] animate-fadeIn">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-[#1e3a5f] animate-pulse flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <div className="absolute -inset-4 bg-slate-500/20 rounded-3xl blur-xl animate-pulse" />
        </div>
        <p className="mt-6 text-gray-600 font-medium">Loading profile...</p>
        <p className="text-sm text-gray-400 mt-1">Getting your information</p>
      </div>
    );
  }

  // ----------------------------------------------------
  // MAIN UI
  // ----------------------------------------------------
  return (
    <div className="page-wrapper w-full max-w-5xl mx-auto p-6 space-y-8">
      {/* HEADER CARD */}
      <div className="page-content relative overflow-hidden rounded-3xl bg-[#1e3a5f] p-8">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center">
          {/* Avatar with gradient ring */}
          <div className="relative">
            <div className="absolute -inset-1 bg-linear-to-br from-white/40 to-white/10 rounded-full blur" />
            <Avatar className="relative w-28 h-28 border-4 border-white/30 shadow-xl">
              <AvatarFallback className="text-3xl font-bold bg-slate-600 text-white">
                {profile?.firstName?.[0]}
                {profile?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            {completionPercentage === 100 && (
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-400 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left text-white">
            <h1 className="text-3xl font-bold">
              {profile?.firstName} {profile?.lastName}
            </h1>

            <div className="flex justify-center md:justify-start items-center gap-2 text-white/80 mt-2">
              <Mail className="w-4 h-4" />
              <span className="text-sm">{profile?.email}</span>
            </div>

            <div className="flex justify-center md:justify-start items-center gap-2 text-white/80 mt-1">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">Joined {formatDate(profile!.createdAt)}</span>
            </div>

            {profile?.lastUpdated && (
              <p className="text-xs text-white/60 mt-2">
                Last updated: {formatDate(profile.lastUpdated)}
              </p>
            )}
          </div>

          {!editing && (
            <Button
              onClick={() => {
                setEditing(true);
                toast.info("You are now editing your profile.");
                logActivity("Opened Profile Edit Mode");
              }}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm transition-all hover:scale-105"
            >
              <Pencil className="mr-2 w-4 h-4" /> Edit Profile
            </Button>
          )}
        </div>
      </div>

      {/* PROFILE COMPLETION */}
      <Card className="border-0 shadow-card overflow-hidden animate-fadeInUp">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${completionPercentage === 100
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-indigo-100 text-indigo-600"
                }`}>
                {completionPercentage === 100 ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <Sparkles className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Profile Completion</h3>
                <p className="text-sm text-gray-500">
                  {completionPercentage === 100
                    ? "Your profile is complete!"
                    : "Fill in missing fields to complete your profile"
                  }
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-bold ${completionPercentage === 100 ? "text-emerald-600" : "text-indigo-600"
                }`}>
                {completionPercentage}%
              </span>
            </div>
          </div>
          <div className="relative">
            <Progress value={completionPercentage} className="h-3 bg-gray-100" />
            <div
              className={`absolute top-0 left-0 h-3 rounded-full transition-all duration-500 ${completionPercentage === 100
                  ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                  : "bg-[#1e3a5f]"
                }`}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* DETAILS CARD */}
      <Card className="border-0 shadow-card overflow-hidden animate-fadeInUp delay-100">
        <CardHeader className="bg-linear-to-r from-gray-50 to-white border-b border-gray-100 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1e3a5f] flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Profile Details</CardTitle>
              <CardDescription>
                {editing ? "Update your profile information" : "Your personal information"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8 space-y-10">
          {/* PERSONAL INFO */}
          <div className="form-section p-0 border-0 shadow-none">
            <h3 className="form-section-title text-gray-800">
              <User className="w-5 h-5 text-indigo-500" />
              Personal Information
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-medium text-gray-700">First Name</Label>
                <Input
                  className={`${editClass} transition-all duration-200`}
                  disabled={!editing}
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: capitalize(e.target.value) })
                  }
                />
                {errors.firstName && <p className="text-red-500 text-sm">{errors.firstName}</p>}
              </div>

              <div className="space-y-2">
                <Label className="font-medium text-gray-700">Last Name</Label>
                <Input
                  className={`${editClass} transition-all duration-200`}
                  disabled={!editing}
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: capitalize(e.target.value) })
                  }
                />
                {errors.lastName && <p className="text-red-500 text-sm">{errors.lastName}</p>}
              </div>
            </div>
          </div>

          <Separator className="bg-gray-100" />

          {/* OTHER DETAILS */}
          <div className="form-section p-0 border-0 shadow-none">
            <h3 className="form-section-title text-gray-800">
              <Shield className="w-5 h-5 text-purple-500" />
              Additional Details
            </h3>

            <div className="space-y-2">
              <Label className="font-medium text-gray-700">Gender</Label>
              {editing ? (
                <Select
                  value={formData.gender}
                  onValueChange={(value) =>
                    setFormData({ ...formData, gender: value })
                  }
                >
                  <SelectTrigger className={`${editClass} transition-all duration-200`}>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input disabled className="bg-gray-50 border-gray-200" value={formatGender(formData.gender)} />
              )}
            </div>
          </div>

          <Separator className="bg-gray-100" />

          {/* CONTACT INFO */}
          <div className="form-section p-0 border-0 shadow-none">
            <h3 className="form-section-title text-gray-800">
              <Phone className="w-5 h-5 text-blue-500" />
              Contact Information
            </h3>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="font-medium text-gray-700">Contact Number</Label>
                <Input
                  className={`${editClass} transition-all duration-200`}
                  disabled={!editing}
                  value={formData.contactNumber}
                  placeholder="+63 XXX XXX XXXX"
                  onChange={(e) =>
                    setFormData({ ...formData, contactNumber: cleanPhone(e.target.value) })
                  }
                />
                {errors.contactNumber && <p className="text-red-500 text-sm">{errors.contactNumber}</p>}
              </div>

              <div className="space-y-2">
                <Label className="font-medium text-gray-700 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  Address
                </Label>
                {editing ? (
                  <Textarea
                    className={`${editClass} transition-all duration-200 min-h-[100px]`}
                    rows={3}
                    placeholder="Enter your full address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                  />
                ) : (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-gray-700">
                    {formData.address || <span className="text-gray-400 italic">No address provided</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          {editing && (
            <div className="flex justify-end gap-4 pt-6 border-t border-gray-100">
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  toast.warning("Edit cancelled.");
                  logActivity("Cancelled Profile Edit");
                }}
                className="px-6 hover:bg-gray-50"
              >
                <X className="mr-2 w-4 h-4" /> Cancel
              </Button>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="px-8 bg-[#1e3a5f] hover:bg-[#2d4a6f] shadow-lg shadow-slate-500/25 hover:shadow-xl hover:shadow-slate-500/30 transition-all">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 w-4 h-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
