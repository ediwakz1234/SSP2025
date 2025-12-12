import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import {
    ChevronDown,
    ChevronUp,
    Clock,
    DollarSign,
    MapPin,
    TrendingUp,
    AlertTriangle,
    Lightbulb,
    Building,
    Home,
} from "lucide-react";
import { useState } from "react";
import type {
    CapitalLevel,
    ProfitabilityLevel,
    RiskLevel,
    TimeWorkFeasibility,
    ZoneSuitability,
} from "../../utils/zoneAnalysis";

// Enhanced Opportunity Type
export interface EnhancedOpportunityData {
    // Core fields
    title: string;
    category: string;
    location: string;
    businessDensity: number;
    competitors: number;
    zone_type: string;
    saturation: number;
    score: number;
    cluster?: number;
    coordinates: {
        lat: number;
        lng: number;
    };
    insights: string[];

    // Enhanced fields
    requiredCapital: CapitalLevel;
    expectedProfitability: ProfitabilityLevel;
    riskLevel: RiskLevel;
    suggestedBusinessModel: string;
    timeWorkFeasibility: TimeWorkFeasibility;
    zoneSuitability: ZoneSuitability;
}

interface BusinessOpportunityCardProps {
    opportunity: EnhancedOpportunityData;
    index: number;
    onViewOnMap?: (lat: number, lng: number, label: string) => void;
}

// Badge color utilities
function getProfitabilityColor(level: ProfitabilityLevel): string {
    switch (level) {
        case "Very High": return "bg-linear-to-r from-emerald-500 to-green-600 text-white";
        case "High": return "bg-linear-to-r from-green-500 to-emerald-600 text-white";
        case "Moderate": return "bg-linear-to-r from-amber-500 to-yellow-600 text-white";
        case "Low": return "bg-linear-to-r from-gray-400 to-gray-500 text-white";
    }
}

function getCapitalColor(level: CapitalLevel): string {
    switch (level) {
        case "Low": return "bg-emerald-100 text-emerald-700";
        case "Medium": return "bg-amber-100 text-amber-700";
        case "High": return "bg-rose-100 text-rose-700";
    }
}

function getRiskColor(level: RiskLevel): string {
    switch (level) {
        case "Low": return "bg-green-100 text-green-700";
        case "Medium": return "bg-amber-100 text-amber-700";
        case "High": return "bg-red-100 text-red-700";
    }
}

function getZoneSuitabilityIcon(suitability: ZoneSuitability) {
    switch (suitability) {
        case "Residential": return <Home className="w-4 h-4" />;
        case "Commercial": return <Building className="w-4 h-4" />;
        case "Both": return (
            <div className="flex -space-x-1">
                <Home className="w-3 h-3" />
                <Building className="w-3 h-3" />
            </div>
        );
    }
}

export function BusinessOpportunityCard({
    opportunity,
    index,
    onViewOnMap
}: BusinessOpportunityCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <Card className="overflow-hidden border-0 shadow-xl bg-white/80 backdrop-blur-sm group hover:shadow-2xl transition-all">
            {/* Header with Badges */}
            <CardHeader className="bg-linear-to-r from-blue-50 via-indigo-50 to-purple-50 border-b pb-4">
                {/* Top Badge Row */}
                <div className="flex flex-wrap gap-2 mb-3">
                    <Badge className="bg-linear-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-md">
                        Cluster {opportunity.cluster}
                    </Badge>
                    <Badge className={`border-0 shadow-md ${getProfitabilityColor(opportunity.expectedProfitability)}`}>
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {opportunity.expectedProfitability} Profit
                    </Badge>
                    <Badge className={`border-0 ${getCapitalColor(opportunity.requiredCapital)}`}>
                        <DollarSign className="w-3 h-3 mr-1" />
                        {opportunity.requiredCapital} Capital
                    </Badge>
                    <Badge className={`border-0 ${getRiskColor(opportunity.riskLevel)}`}>
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {opportunity.riskLevel} Risk
                    </Badge>
                </div>

                {/* Title */}
                <CardTitle className="text-xl group-hover:text-indigo-600 transition-colors">
                    {opportunity.title}
                </CardTitle>

                {/* Location & Zone */}
                <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                    <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-indigo-500" />
                        {opportunity.location}
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white/60 rounded-lg">
                        {getZoneSuitabilityIcon(opportunity.zoneSuitability)}
                        <span className="text-xs font-medium">{opportunity.zoneSuitability}</span>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
                {/* Quick Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Score */}
                    <div className="p-3 bg-linear-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Score</p>
                        <div className="text-2xl font-bold text-blue-700">{opportunity.score}%</div>
                    </div>

                    {/* Business Density */}
                    <div className="p-3 bg-linear-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Density</p>
                        <div className="text-2xl font-bold text-green-700">{opportunity.businessDensity}</div>
                    </div>

                    {/* Competitors */}
                    <div className="p-3 bg-linear-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Competitors</p>
                        <div className="text-2xl font-bold text-amber-700">{opportunity.competitors}</div>
                    </div>

                    {/* Saturation */}
                    <div className="p-3 bg-linear-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Saturation</p>
                        <div className="text-2xl font-bold text-purple-700">{opportunity.saturation}%</div>
                    </div>
                </div>

                {/* Time Work Feasibility Tag */}
                <div className="flex items-center gap-3 p-4 bg-linear-to-r from-sky-50 to-cyan-50 rounded-xl border border-sky-200">
                    <div className="p-2 bg-sky-500 rounded-lg text-white">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-sky-900">
                            Recommended Hours: {opportunity.timeWorkFeasibility.recommendedHours}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                            {opportunity.timeWorkFeasibility.flexibility} schedule • Peak impact: {opportunity.timeWorkFeasibility.profitImpact}
                        </p>
                    </div>
                </div>

                {/* Suggested Business Model */}
                <div className="p-4 bg-linear-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                    <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4 text-indigo-600" />
                        <p className="text-sm font-semibold text-indigo-900">Suggested Business Model</p>
                    </div>
                    <p className="text-sm text-gray-700">{opportunity.suggestedBusinessModel}</p>
                </div>

                {/* Expandable Details */}
                <div className="border-t pt-4">
                    <Button
                        variant="ghost"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full flex items-center justify-between text-gray-600 hover:text-gray-900"
                    >
                        <span className="text-sm font-medium">
                            {isExpanded ? "Hide Details" : "Show Full Analysis"}
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>

                    {isExpanded && (
                        <div className="mt-4 space-y-4 animate-fadeIn">
                            {/* Peak Hours */}
                            <div className="p-4 bg-gray-50 rounded-xl">
                                <p className="text-sm font-semibold text-gray-700 mb-2">Peak Business Hours</p>
                                <div className="flex flex-wrap gap-2">
                                    {opportunity.timeWorkFeasibility.peakHours.map((hours, i) => (
                                        <Badge key={i} variant="outline" className="px-3 py-1">
                                            {hours}
                                        </Badge>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    {opportunity.timeWorkFeasibility.demandReasoning}
                                </p>
                            </div>

                            {/* Insights */}
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4 text-amber-500" />
                                    Key Insights
                                </p>
                                <div className="grid md:grid-cols-2 gap-2">
                                    {opportunity.insights.map((insight, i) => (
                                        <div
                                            key={i}
                                            className="p-3 bg-linear-to-r from-gray-50 to-slate-50 rounded-lg text-sm text-gray-700 border hover:border-indigo-200 transition-colors"
                                        >
                                            {insight}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Coordinates */}
                            <div className="text-sm text-gray-500 font-mono pt-2">
                                📍 {opportunity.coordinates.lat.toFixed(5)}°, {opportunity.coordinates.lng.toFixed(5)}°
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Button */}
                <Button
                    className="w-full bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white rounded-xl shadow-lg shadow-slate-200 transition-all hover:scale-[1.02]"
                    onClick={() => onViewOnMap?.(
                        opportunity.coordinates.lat,
                        opportunity.coordinates.lng,
                        opportunity.title
                    )}
                >
                    <MapPin className="w-4 h-4 mr-2" />
                    View on Map
                </Button>
            </CardContent>
        </Card>
    );
}
