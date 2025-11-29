import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../ui/card';

import {
  MapPin,
  Shield,
  Users,
  Target,
  BarChart3
} from 'lucide-react';

import { useNavigate } from "react-router-dom";



export function LandingPage() {
  
  const navigate = useNavigate(); // ✅ Correct placement

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-[#f9f9ff] to-[#f4f2ff]">
      <div className="container mx-auto px-4 py-16">

        {/* HERO */}
        <div className="text-center max-w-4xl mx-auto mb-24">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-200 rounded-2xl shadow-sm mb-6">
            <MapPin className="w-10 h-10 text-black" />
          </div>

          <h1 className="text-5xl font-semibold text-gray-800 mb-4">
            Strategic Store Placement
          </h1>

          <p className="text-xl text-gray-600">
            Optimizing Business Location Using K-Means Clustering
          </p>

          <p className="text-lg text-gray-600 mt-1">
            Brgy. Sta. Cruz, Santa Maria, Bulacan
          </p>

          <p className="text-sm text-gray-500 mt-4">
            A comprehensive business analytics platform using real field survey data
          </p>
        </div>

        {/* FEATURE CARDS */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-20">
          <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
            <CardHeader>
              <Target className="w-12 h-12 text-black mb-4" />
              <CardTitle className="text-gray-800">K-Means Clustering</CardTitle>
              <CardDescription className="text-gray-600">
                Advanced clustering algorithm using the Haversine formula for precise geographic analysis.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
            <CardHeader>
              <BarChart3 className="w-12 h-12 text-black mb-4" />
              <CardTitle className="text-gray-800">Real-Time Analytics</CardTitle>
              <CardDescription className="text-gray-600">
                Interactive map visualization & competitor analysis for informed business decisions.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* PORTALS */}
        <div className="grid md:grid-cols-2 gap-10 max-w-4xl mx-auto">
          
          {/* USER PORTAL */}
          <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                
                <Users className="w-8 h-8 text-blue-600/80" />
              </div>

              <CardTitle className="text-2xl text-gray-800">User Portal</CardTitle>
              <CardDescription className="text-gray-600">
                Access clustering results & business recommendations
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-gray-700">
                <FeatureItem text="K-Means Cluster Analysis" />
                <FeatureItem text="Interactive Map Visualization" />
                <FeatureItem text="Business Opportunities" />
                <FeatureItem text="Analytics Dashboard" />
                <FeatureItem text="Personal Profile" />
              </div>

              <Button
                className="w-full mt-4 bg-black hover:bg-gray-800 text-white"
                onClick={() => navigate("/user/login")}  
              >
                Access User Portal
              </Button>
            </CardContent>
          </Card>

          {/* ADMIN PORTAL */}
          <Card className="bg-white border border-gray-200 shadow-sm rounded-xl">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <Shield className="w-8 h-8 text-purple-600/80" />
              </div>

              <CardTitle className="text-2xl text-gray-800">Admin Portal</CardTitle>
              <CardDescription className="text-gray-600">
                Manage users, logs, analytics & seed data
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm text-gray-700">
                <FeatureItemAdmin text="System Dashboard" />
                <FeatureItemAdmin text="User Management" />
                <FeatureItemAdmin text="Activity Logs" />
                <FeatureItemAdmin text="Analytics Overview" />
                <FeatureItemAdmin text="Seed Data Management" />
              </div>

              <Button
                className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={() => navigate("/admin/login")}  // ✅ FIXED
              >
                Access Admin Portal
              </Button>
            </CardContent>
          </Card>

        </div>

        {/* CTA */}
        <div className="text-center mt-24">
          <p className="text-gray-600 mb-4">
            Ready to find the perfect location for your business?
          </p>

          <Button
            size="lg"
            className="bg-black hover:bg-gray-800 text-white"
            onClick={() => navigate("/user/login")}  // ✅ FIXED
          >
            Get Started Now
          </Button>
        </div>

        {/* FOOTER */}
        <div className="text-center mt-20 text-sm text-gray-500">
          <p>Thesis Project © 2025</p>
          <p className="mt-2">
            Strategic Store Placement System • Brgy. Sta. Cruz, Santa Maria, Bulacan
          </p>
        </div>

      </div>
    </div>
  );
}

/* Small components */
function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-black" />
      <span>{text}</span>
    </div>
  );
}

function FeatureItemAdmin({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-purple-600/80" />
      <span>{text}</span>
    </div>
  );
}

export default LandingPage;
