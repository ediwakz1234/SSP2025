import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import {
    MapPin,
    Building,
    Home,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    Zap
} from "lucide-react";
import type { ZoneAnalysisResult, ZoneSuitabilityResult } from "../../utils/zoneAnalysis";

interface ZoneAnalysisProps {
    analysis: ZoneAnalysisResult;
    suitability: ZoneSuitabilityResult;
    category: string;
    className?: string;
}

function getCompetitionColor(level: "Low" | "Medium" | "High"): string {
    switch (level) {
        case "Low": return "bg-green-100 text-green-700";
        case "Medium": return "bg-amber-100 text-amber-700";
        case "High": return "bg-red-100 text-red-700";
    }
}

function getDemandColor(level: "Low" | "Medium" | "High"): string {
    switch (level) {
        case "High": return "bg-green-100 text-green-700";
        case "Medium": return "bg-amber-100 text-amber-700";
        case "Low": return "bg-red-100 text-red-700";
    }
}

function getAccessibilityColor(level: "Poor" | "Moderate" | "Good" | "Excellent"): string {
    switch (level) {
        case "Excellent": return "bg-emerald-100 text-emerald-700";
        case "Good": return "bg-green-100 text-green-700";
        case "Moderate": return "bg-amber-100 text-amber-700";
        case "Poor": return "bg-red-100 text-red-700";
    }
}

export function ZoneAnalysis({ analysis, suitability, category, className = "" }: ZoneAnalysisProps) {
    return (
        <div className={`space-y-6 ${className}`}>
            {/* Best Zone Banner */}
            <Card className="border-0 shadow-xl overflow-hidden">
                <div className="bg-linear-to-r from-emerald-500 via-teal-500 to-cyan-600 p-6 text-white">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                                <MapPin className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-emerald-100 text-sm font-medium">Recommended Zone</p>
                                <h2 className="text-3xl font-bold tracking-tight">{analysis.bestZone}</h2>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-5xl font-bold">{analysis.score}%</div>
                            <p className="text-emerald-100 text-sm">Zone Score</p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Zone Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Residential Zone Card */}
                <Card className={`border-2 transition-all ${suitability.suitability === "Residential" || suitability.suitability === "Both"
                        ? "border-emerald-300 shadow-lg shadow-emerald-100"
                        : "border-gray-200"
                    }`}>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${suitability.suitability === "Residential" || suitability.suitability === "Both"
                                    ? "bg-emerald-500 text-white"
                                    : "bg-gray-200 text-gray-600"
                                }`}>
                                <Home className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Residential Zone</CardTitle>
                                <CardDescription>Community-focused placement</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-600">Suitability Score</span>
                                <span className="font-semibold text-emerald-600">{suitability.residentialScore}%</span>
                            </div>
                            <Progress value={suitability.residentialScore} className="h-2" />
                        </div>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                Lower rental costs
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                Community loyalty potential
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                Flexible operating hours
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Commercial Zone Card */}
                <Card className={`border-2 transition-all ${suitability.suitability === "Commercial" || suitability.suitability === "Both"
                        ? "border-blue-300 shadow-lg shadow-blue-100"
                        : "border-gray-200"
                    }`}>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${suitability.suitability === "Commercial" || suitability.suitability === "Both"
                                    ? "bg-blue-500 text-white"
                                    : "bg-gray-200 text-gray-600"
                                }`}>
                                <Building className="w-5 h-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Commercial Zone</CardTitle>
                                <CardDescription>High-traffic placement</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-600">Suitability Score</span>
                                <span className="font-semibold text-blue-600">{suitability.commercialScore}%</span>
                            </div>
                            <Progress value={suitability.commercialScore} className="h-2" />
                        </div>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                                Higher foot traffic
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                                Better visibility
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                                Business synergy opportunities
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Zone Analysis Details */}
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 border-b">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[#1e3a5f] rounded-xl text-white shadow-lg">
                            <Zap className="w-5 h-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Zone Analysis Details</CardTitle>
                            <CardDescription>Key factors for {category}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                    {/* Quick Metrics */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-linear-to-br from-gray-50 to-slate-50 rounded-xl text-center">
                            <p className="text-xs text-gray-500 mb-2">Competition</p>
                            <Badge className={`${getCompetitionColor(analysis.competitionLevel)} border-0`}>
                                {analysis.competitionLevel}
                            </Badge>
                        </div>
                        <div className="p-4 bg-linear-to-br from-gray-50 to-slate-50 rounded-xl text-center">
                            <p className="text-xs text-gray-500 mb-2">Market Demand</p>
                            <Badge className={`${getDemandColor(analysis.marketDemand)} border-0`}>
                                {analysis.marketDemand}
                            </Badge>
                        </div>
                        <div className="p-4 bg-linear-to-br from-gray-50 to-slate-50 rounded-xl text-center">
                            <p className="text-xs text-gray-500 mb-2">Accessibility</p>
                            <Badge className={`${getAccessibilityColor(analysis.accessibility)} border-0`}>
                                {analysis.accessibility}
                            </Badge>
                        </div>
                    </div>

                    {/* Reasoning */}
                    <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-indigo-500" />
                            Why This Zone?
                        </h4>
                        <div className="space-y-2">
                            {analysis.reasoning.map((reason, index) => (
                                <div
                                    key={index}
                                    className="p-3 bg-linear-to-r from-indigo-50 to-purple-50 rounded-lg text-sm text-gray-700 border border-indigo-100"
                                >
                                    {reason}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Suitability Explanation */}
                    <div className="p-4 bg-linear-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-amber-900 mb-1">
                                    {suitability.suitability === "Both"
                                        ? "Dual Zone Opportunity"
                                        : `Best for ${suitability.suitability} Zones`}
                                </p>
                                <p className="text-sm text-gray-700">{suitability.explanation}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
