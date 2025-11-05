import { useState, useRef, useEffect } from 'react';
import { Camera, Mail, Phone, MapPin, Save } from 'lucide-react';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { toast } from 'sonner';
import type { User } from '../utils'; // ✅ make sure you use "type" import

interface ProfileProps {
    user: User | null; // ✅ allow null when no data yet
}

export function Profile({ user }: ProfileProps) {
    const [profileImage, setProfileImage] = useState<string>(user?.profileImage || '');
    const [formData, setFormData] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || '',
        phone_number: user?.phone_number || '',   // ✅ matches backend
        address: user?.address || '',
        date_of_birth: user?.date_of_birth || '', // ✅ added date_of_birth
        age: user?.age ? user.age.toString() : '',
        gender: user?.gender || '',
        bio: user?.bio || '',
    });

    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ✅ Fetch profile safely with token
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const token = localStorage.getItem('access_token');
                if (!token) {
                    console.error('No token found');
                    toast.error('You must be logged in to view your profile.');
                    setLoading(false);
                    return;
                }

                const res = await fetch('http://127.0.0.1:8000/api/v1/users/me', {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!res.ok) {
                    if (res.status === 401) toast.error('Session expired. Please log in again.');
                    throw new Error(`Failed to fetch user: ${res.status}`);
                }

                const data = await res.json();

                const computedAge = data.date_of_birth ? calculateAge(data.date_of_birth) : (data.age ? data.age.toString() : '');

                setFormData({
                    firstName: data.first_name || '',
                    lastName: data.last_name || '',
                    email: data.email || '',
                    phone_number: user?.phone_number || '',
                    address: data.address || '',
                    date_of_birth: data.date_of_birth || '',
                    age: computedAge,
                    gender: data.gender || '',
                    bio: data.bio || '',
                });

                setProfileImage(data.profile_image || '');
            } catch (err) {
                console.error(err);
                toast.error('❌ Failed to load profile data');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

    // ✅ Image upload (local preview only)
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfileImage(reader.result as string);
                toast.success('Profile picture updated successfully!');
            };
            reader.readAsDataURL(file);
        }
    };

    // ✅ Calculate age automatically from birthdate
    const calculateAge = (dob: string) => {
        if (!dob) return '';
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age.toString();
    };

    // ✅ Handle input change safely
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;

        if (name === 'date_of_birth') {
            const computedAge = calculateAge(value);
            setFormData({
                ...formData,
                date_of_birth: value,
                age: computedAge,
            });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    // ✅ Save updates to backend
    const handleSave = async () => {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) {
                toast.error('You must be logged in to save changes.');
                return;
            }

            const res = await fetch('http://127.0.0.1:8000/api/v1/users/me', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    email: formData.email,
                    phone_number: formData.phone_number,
                    address: formData.address,
                    date_of_birth: formData.date_of_birth,
                    age: formData.age ? parseInt(formData.age) : null,
                    gender: formData.gender,
                    bio: formData.bio,
                }),
            });

            if (!res.ok) throw new Error('Failed to update profile');
            toast.success('✅ Profile updated successfully!');
        } catch (err) {
            console.error(err);
            toast.error('❌ Failed to update profile');
        }
    };

    // ✅ Fallback for missing initials
    const getInitials = () => {
        if (!formData.firstName && !formData.lastName) return '??';
        return `${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh] text-gray-500">
                Loading profile...
            </div>
        );
    }

    // ✅ Prevent crash if data fails
    if (!formData.email) {
        return (
            <div className="flex items-center justify-center h-[60vh] text-gray-500">
                Failed to load profile data.
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto">
            <div className="p-8">
                <div className="mb-8">
                    <h1>Profile Settings</h1>
                    <p className="text-gray-600">Customize your profile and personal information</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Profile Picture */}
                    <Card className="p-6 lg:col-span-1 h-fit">
                        <h2 className="mb-6">Profile Picture</h2>
                        <div className="flex flex-col items-center">
                            <div className="relative group mb-4">
                                <Avatar className="w-32 h-32">
                                    <AvatarImage src={profileImage} alt="Profile" />
                                    <AvatarFallback className="text-3xl">{getInitials()}</AvatarFallback>
                                </Avatar>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Camera className="w-8 h-8 text-white" />
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                            </div>
                            <p className="text-center mb-2">
                                {formData.firstName} {formData.lastName}
                            </p>
                            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="mt-4 w-full">
                                <Camera className="w-4 h-4 mr-2" />
                                Change Picture
                            </Button>
                        </div>
                    </Card>

                    {/* Information */}
                    <Card className="p-6 lg:col-span-2">
                        <h2 className="mb-6">Personal Information</h2>
                        <div className="space-y-6">
                            {/* Name */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">First Name</Label>
                                    <Input id="firstName" name="firstName" value={formData.firstName} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Last Name</Label>
                                    <Input id="lastName" name="lastName" value={formData.lastName} onChange={handleInputChange} />
                                </div>
                            </div>

                            {/* Contact */}
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} className="pl-10" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone_number">Phone Number</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input id="phone_number" name="phone_number" type="tel" value={formData.phone_number} onChange={handleInputChange} className="pl-10" />
                                </div>
                            </div>

                            {/* ✅ Date of Birth (replaced organization/position) */}
                            <div className="space-y-2">
                                <Label htmlFor="date_of_birth">Date of Birth</Label>
                                <Input
                                    id="date_of_birth"
                                    name="date_of_birth"
                                    type="date"
                                    value={formData.date_of_birth}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="address">Address</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input id="address" name="address" value={formData.address} onChange={handleInputChange} className="pl-10" />
                                </div>
                            </div>

                            {/* Age + Gender */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="age">Age</Label>
                                    <Input
                                        id="age"
                                        name="age"
                                        type="number"
                                        value={formData.age}
                                        readOnly
                                        disabled
                                        className="bg-gray-100 cursor-not-allowed"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="gender">Gender</Label>
                                    <Input id="gender" name="gender" value={formData.gender} readOnly className="capitalize" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="bio">Bio</Label>
                                <Textarea id="bio" name="bio" value={formData.bio} onChange={handleInputChange} rows={4} />
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button onClick={handleSave} className="px-8">
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Changes
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
