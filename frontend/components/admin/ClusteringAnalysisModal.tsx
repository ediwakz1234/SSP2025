import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../ui/dialog";
import { Badge } from "../ui/badge";
import {
    User,
    MapPin,
    Target,
    TrendingUp,
    Calendar,
    Building2,
    AlertTriangle,
    ChevronRight,
    Trophy,
} from "lucide-react";

// Types
export interface ClusteringAnalysisResult {
    id: number;
    user_id: string;
    business_category: string;
    num_clusters: number;
    recommended_latitude: number;
    recommended_longitude: number;
    recommended_zone_type: string;
    confidence: number;
    opportunity_level: string;
    total_businesses: number;
    competitor_count: number;
    competitors_within_500m: number;
    competitors_within_1km: number;
    competitors_within_2km: number;
    market_saturation: number;
    created_at: string;
    // Joined from profiles
    user_name?: string;
    user_email?: string;
}

interface ClusteringAnalysisModalProps {
    analysis: ClusteringAnalysisResult | null;
    open: boolean;
    onClose: () => void;
    rank?: number;
}

export function ClusteringAnalysisModal({
    analysis,
    open,
    onClose,
    rank,
}: ClusteringAnalysisModalProps) {
    if (!analysis) return null;

    const confidencePercent = Math.round(analysis.confidence * 100);
    const saturationPercent = Math.round(analysis.market_saturation * 100);

    // Color coding for confidence
    const getConfidenceColor = (percent: number) => {
        if (percent >= 70) return "from-green-500 to-emerald-600";
        if (percent >= 40) return "from-yellow-500 to-amber-600";
        return "from-red-500 to-rose-600";
    };

    const getConfidenceTextColor = (percent: number) => {
        if (percent >= 70) return "text-green-600";
        if (percent >= 40) return "text-amber-600";
        return "text-red-600";
    };

    const getOpportunityBadge = (level: string) => {
        const l = level.toLowerCase();
        if (l.includes("high") || l.includes("strong"))
            return "bg-green-100 text-green-800 border-green-200";
        if (l.includes("moderate") || l.includes("medium"))
            return "bg-yellow-100 text-yellow-800 border-yellow-200";
        return "bg-red-100 text-red-800 border-red-200";
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl bg-white rounded-2xl shadow-2xl border-0 p-0 overflow-hidden">
                {/* Header */}
                <DialogHeader className="bg-slate-700 text-white p-6">
                    <div className="flex items-center gap-4">
                        {rank && rank <= 3 && (
                            <div
                                className={`flex h-12 w-12 items-center justify-center rounded-full ${rank === 1
                                        ? "bg-yellow-400/30"
                                        : rank === 2
                                            ? "bg-gray-300/30"
                                            : "bg-amber-600/30"
                                    }`}
                            >
                                <Trophy
                                    className={`h-6 w-6 ${rank === 1
                                            ? "text-yellow-300"
                                            : rank === 2
                                                ? "text-gray-200"
                                                : "text-amber-400"
                                        }`}
                                />
                            </div>
                        )}
                        <div>
                            <DialogTitle className="text-xl font-bold text-white">
                                Clustering Analysis Result
                            </DialogTitle>
                            <p className="text-purple-100 text-sm mt-1">
                                {rank ? `#${rank} Top Score` : "Analysis Details"}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* User Information */}
                    <div className="p-4 rounded-xl bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-100">
                        <div className="flex items-center gap-2 mb-3">
                            <User className="h-4 w-4 text-blue-600" />
                            <h3 className="font-semibold text-gray-800">User Information</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                    Name
                                </p>
                                <p className="font-medium text-gray-800">
                                    {analysis.user_name || "Unknown User"}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                    Email
                                </p>
                                <p className="font-medium text-gray-600 text-sm truncate">
                                    {analysis.user_email || "N/A"}
                                </p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                    Analysis Date
                                </p>
                                <p className="font-medium text-gray-800 flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-gray-400" />
                                    {new Date(analysis.created_at).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Business Analysis */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200">
                        <div className="flex items-center gap-2 mb-3">
                            <Building2 className="h-4 w-4 text-slate-600" />
                            <h3 className="font-semibold text-gray-800">Business Analysis</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                    Category
                                </p>
                                <Badge className="mt-1 bg-slate-100 text-slate-800 border-slate-200 font-medium">
                                    {analysis.business_category}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                    Opportunity Level
                                </p>
                                <Badge
                                    className={`mt-1 font-medium ${getOpportunityBadge(
                                        analysis.opportunity_level
                                    )}`}
                                >
                                    {analysis.opportunity_level}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                    Clusters Used
                                </p>
                                <p className="font-bold text-2xl text-purple-600">
                                    {analysis.num_clusters}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                    Total Businesses
                                </p>
                                <p className="font-bold text-2xl text-purple-600">
                                    {analysis.total_businesses}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Score Breakdown */}
                    <div className="p-4 rounded-xl bg-linear-to-r from-green-50 to-emerald-50 border border-green-100">
                        <div className="flex items-center gap-2 mb-4">
                            <Target className="h-4 w-4 text-green-600" />
                            <h3 className="font-semibold text-gray-800">Score Breakdown</h3>
                        </div>

                        {/* Confidence Score */}
                        <div className="mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-700">
                                    Match Confidence
                                </span>
                                <span
                                    className={`text-2xl font-bold ${getConfidenceTextColor(
                                        confidencePercent
                                    )}`}
                                >
                                    {confidencePercent}%
                                </span>
                            </div>
                            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full bg-linear-to-r ${getConfidenceColor(
                                        confidencePercent
                                    )} transition-all duration-500`}
                                    style={{ width: `${confidencePercent}%` }}
                                />
                            </div>
                        </div>

                        {/* Market Saturation */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-gray-700">
                                    Market Saturation
                                </span>
                                <span className="text-lg font-semibold text-gray-700">
                                    {saturationPercent}%
                                </span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-linear-to-r from-orange-400 to-red-500 transition-all duration-500"
                                    style={{ width: `${Math.min(saturationPercent, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Location & Competitors */}
                    <div className="p-4 rounded-xl bg-linear-to-r from-amber-50 to-orange-50 border border-amber-100">
                        <div className="flex items-center gap-2 mb-3">
                            <MapPin className="h-4 w-4 text-amber-600" />
                            <h3 className="font-semibold text-gray-800">
                                Location & Competition
                            </h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                    Recommended Zone
                                </p>
                                <Badge className="mt-1 bg-amber-100 text-amber-800 border-amber-200">
                                    {analysis.recommended_zone_type}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide">
                                    Coordinates
                                </p>
                                <p className="text-sm font-mono text-gray-600">
                                    {analysis.recommended_latitude.toFixed(5)},{" "}
                                    {analysis.recommended_longitude.toFixed(5)}
                                </p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                                    Competitor Distribution
                                </p>
                                <div className="flex gap-2">
                                    <div className="flex-1 p-2 bg-white rounded-lg text-center border">
                                        <p className="text-lg font-bold text-red-600">
                                            {analysis.competitors_within_500m}
                                        </p>
                                        <p className="text-xs text-gray-500">Within 500m</p>
                                    </div>
                                    <div className="flex-1 p-2 bg-white rounded-lg text-center border">
                                        <p className="text-lg font-bold text-orange-600">
                                            {analysis.competitors_within_1km}
                                        </p>
                                        <p className="text-xs text-gray-500">Within 1km</p>
                                    </div>
                                    <div className="flex-1 p-2 bg-white rounded-lg text-center border">
                                        <p className="text-lg font-bold text-amber-600">
                                            {analysis.competitors_within_2km}
                                        </p>
                                        <p className="text-xs text-gray-500">Within 2km</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
