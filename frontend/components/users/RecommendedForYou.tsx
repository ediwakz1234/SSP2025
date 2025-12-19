import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import {
    Sparkles,
    Sun,
    Moon,
    Clock,
    Building2,
    AlertTriangle,
    CheckCircle2,
    Zap,
    Target,
    ChevronRight,
} from "lucide-react";
import {
    generateFullRecommendation,
    type RecommendationData,
    type FullRecommendation,
} from "../../utils/recommendationUtils";
import { useMemo } from "react";

interface RecommendedForYouProps {
    businessType: string;
    competitionLevel: "Low" | "Medium" | "High";
    zoneType: string;
    activityTime: "Day" | "Evening" | "Both";
    avgDensity: number;
    avgCompetitors: number;
    clusterCount: number;
}

function getRiskColor(level: "Low" | "Medium" | "High") {
    switch (level) {
        case "Low":
            return "bg-emerald-100 text-emerald-700 border-emerald-200";
        case "Medium":
            return "bg-amber-100 text-amber-700 border-amber-200";
        case "High":
            return "bg-rose-100 text-rose-700 border-rose-200";
    }
}

function getRiskBgColor(level: "Low" | "Medium" | "High") {
    switch (level) {
        case "Low":
            return "from-emerald-50 to-green-50 border-emerald-100";
        case "Medium":
            return "from-amber-50 to-yellow-50 border-amber-100";
        case "High":
            return "from-rose-50 to-pink-50 border-rose-100";
    }
}

function getOperatingIcon(time: "Day" | "Evening" | "Both") {
    switch (time) {
        case "Day":
            return <Sun className="w-5 h-5 text-amber-500" />;
        case "Evening":
            return <Moon className="w-5 h-5 text-indigo-500" />;
        case "Both":
            return <Clock className="w-5 h-5 text-blue-500" />;
    }
}

function getSizeIcon(size: "Small" | "Medium" | "Large") {
    const baseClass = "w-4 h-4 rounded-full";
    switch (size) {
        case "Small":
            return <div className={`${baseClass} bg-blue-400`} />;
        case "Medium":
            return <div className={`${baseClass} bg-indigo-500 w-5 h-5`} />;
        case "Large":
            return <div className={`${baseClass} bg-purple-600 w-6 h-6`} />;
    }
}

export function RecommendedForYou({
    businessType,
    competitionLevel,
    zoneType,
    activityTime,
    avgDensity,
    avgCompetitors,
    clusterCount,
}: RecommendedForYouProps) {
    // Generate all recommendations based on input data
    const recommendation: FullRecommendation = useMemo(() => {
        const data: RecommendationData = {
            businessType,
            competitionLevel,
            zoneType,
            activityTime,
            avgDensity,
            avgCompetitors,
            clusterCount,
        };
        return generateFullRecommendation(data);
    }, [businessType, competitionLevel, zoneType, activityTime, avgDensity, avgCompetitors, clusterCount]);

    return (
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            {/* Header */}
            <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 border-b">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white shadow-lg shadow-violet-200">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">Recommended for You</CardTitle>
                        <p className="text-sm text-gray-500">
                            Personalized insights for your {businessType || "business"} opportunity
                        </p>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
                {/* 1. Why This Is Recommended */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <h3 className="font-semibold text-gray-800">Why This Is Recommended for You</h3>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        {recommendation.whyRecommended.summary}
                    </p>
                    <ul className="space-y-2">
                        {recommendation.whyRecommended.points.map((point, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                                <ChevronRight className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
                                {point}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Grid for remaining features */}
                <div className="grid md:grid-cols-2 gap-5">
                    {/* 2. Operating Hours Recommendation */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                                {getOperatingIcon(recommendation.operatingHours.recommended)}
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Best Operating Hours</p>
                                <p className="font-bold text-gray-800">{recommendation.operatingHours.recommended}</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600">
                            {recommendation.operatingHours.reason}
                        </p>
                    </div>

                    {/* 3. Business Size Recommendation */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-purple-500" />
                            </div>
                            <div className="flex items-center gap-2">
                                <div>
                                    <p className="text-xs text-gray-500">Recommended Size</p>
                                    <p className="font-bold text-gray-800">{recommendation.businessSize.recommended}</p>
                                </div>
                                {getSizeIcon(recommendation.businessSize.recommended)}
                            </div>
                        </div>
                        <p className="text-sm text-gray-600">
                            {recommendation.businessSize.reason}
                        </p>
                    </div>

                    {/* 4. Risk Summary */}
                    <div className={`p-4 rounded-xl bg-gradient-to-br ${getRiskBgColor(recommendation.riskSummary.level)} border`}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                                <AlertTriangle className={`w-5 h-5 ${recommendation.riskSummary.level === "Low" ? "text-emerald-500" :
                                    recommendation.riskSummary.level === "Medium" ? "text-amber-500" : "text-rose-500"
                                    }`} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Risk Level</p>
                                <Badge className={`${getRiskColor(recommendation.riskSummary.level)} border font-semibold`}>
                                    {recommendation.riskSummary.level}
                                </Badge>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600">
                            {recommendation.riskSummary.reason}
                        </p>
                    </div>

                    {/* 5. Entry Strategy */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                                <Target className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Entry Strategy</p>
                                <p className="font-bold text-gray-800 text-sm">{recommendation.entryStrategy.strategy}</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600">
                            {recommendation.entryStrategy.reason}
                        </p>
                    </div>
                </div>

                {/* Quick Action Hint */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-gray-50 border border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-slate-500 to-gray-600 rounded-lg text-white">
                            <Zap className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-700">Ready to get started?</p>
                            <p className="text-xs text-gray-500">
                                Use the Zone Analysis and Market Gaps tabs for more detailed insights on specific locations.
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
