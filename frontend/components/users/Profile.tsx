import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

interface ProfileData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  age: number | "";
  gender: string;
  contactNumber: string;
  address: string;
  createdAt: string;
}

export function Profile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    age: "",
    gender: "",
    contactNumber: "",
    address: "",
  });

  // ----------------------------------------------------
  // 🔥 LOAD PROFILE DATA FROM SUPABASE
  // ----------------------------------------------------
  const loadProfile = async () => {
    try {
      setLoadingProfile(true);

      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        toast.error("Failed to load profile.");
        return;
      }

      const u = data.user;

      const p: ProfileData = {
        id: u.id,
        email: u.email ?? "",
        firstName: u.user_metadata.first_name || "",
        lastName: u.user_metadata.last_name || "",
        age: u.user_metadata.age || "",
        gender: u.user_metadata.gender || "",
        contactNumber: u.user_metadata.contact_number || "",
        address: u.user_metadata.address || "",
        createdAt: u.created_at,
      };

      setProfile(p);

      setFormData({
        firstName: p.firstName,
        lastName: p.lastName,
        age: p.age ? String(p.age) : "",
        gender: p.gender,
        contactNumber: p.contactNumber,
        address: p.address,
      });
    } catch (err) {
      console.error(err);
      toast.error("Could not load profile.");
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // ----------------------------------------------------
  // 🔥 UPDATE PROFILE (SUPABASE METADATA)
  // ----------------------------------------------------
  const handleUpdate = async () => {
    try {
      setSaving(true);

      const updates = {
        data: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          age: formData.age ? Number(formData.age) : null,
          gender: formData.gender,
          contact_number: formData.contactNumber,
          address: formData.address,
        },
      };

      const { error } = await supabase.auth.updateUser(updates);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Profile updated successfully!");
      setEditing(false);

      loadProfile();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------
  // UI (UNCHANGED)
  // ----------------------------------------------------
  if (loadingProfile) {
    return <div className="p-6 text-center">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="p-6 text-center">Profile not found</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">My Profile</h2>

      <div className="space-y-4 bg-white p-6 rounded-xl shadow">
        <div>
          <label className="font-medium text-sm">Email</label>
          <Input value={profile.email} disabled className="bg-gray-200" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="font-medium text-sm">First Name</label>
            <Input
              value={formData.firstName}
              disabled={!editing}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
            />
          </div>

          <div>
            <label className="font-medium text-sm">Last Name</label>
            <Input
              value={formData.lastName}
              disabled={!editing}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
            />
          </div>
        </div>

        <div>
          <label className="font-medium text-sm">Age</label>
          <Input
            value={formData.age}
            disabled={!editing}
            onChange={(e) =>
              setFormData({ ...formData, age: e.target.value })
            }
          />
        </div>

        <div>
          <label className="font-medium text-sm">Gender</label>
          <Input
            value={formData.gender}
            disabled={!editing}
            onChange={(e) =>
              setFormData({ ...formData, gender: e.target.value })
            }
          />
        </div>

        <div>
          <label className="font-medium text-sm">Contact Number</label>
          <Input
            value={formData.contactNumber}
            disabled={!editing}
            onChange={(e) =>
              setFormData({ ...formData, contactNumber: e.target.value })
            }
          />
        </div>

        <div>
          <label className="font-medium text-sm">Address</label>
          <Input
            value={formData.address}
            disabled={!editing}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
          />
        </div>

        <div className="flex justify-between pt-4">
          {!editing ? (
            <Button onClick={() => setEditing(true)}>Edit</Button>
          ) : (
            <>
              <Button
                onClick={handleUpdate}
                disabled={saving}
                className="bg-black text-white"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  loadProfile();
                }}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
