import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import {
    AlertTriangle,
    TrendingUp,
    Lightbulb,
    Target,
    MapPin,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { useState } from "react";

export interface InsightsPanelData {
    risks: string[];
    advantages: string[];
    marketConsiderations: string[];
    strategies: string[];
    zoneGuidance: string[];
}

interface InsightsPanelProps {
    insights: InsightsPanelData;
    className?: string;
    defaultExpanded?: boolean;
}

interface InsightSectionProps {
    title: string;
    items: string[];
    icon: React.ReactNode;
    colorScheme: "red" | "green" | "amber" | "blue" | "purple";
    defaultOpen?: boolean;
}

const colorSchemes = {
    red: {
        bg: "from-red-50 to-rose-50",
        border: "border-red-200",
        iconBg: "bg-red-500",
        text: "text-red-900",
        itemBg: "bg-red-50",
        itemBorder: "border-red-100",
    },
    green: {
        bg: "from-green-50 to-emerald-50",
        border: "border-green-200",
        iconBg: "bg-green-500",
        text: "text-green-900",
        itemBg: "bg-green-50",
        itemBorder: "border-green-100",
    },
    amber: {
        bg: "from-amber-50 to-yellow-50",
        border: "border-amber-200",
        iconBg: "bg-amber-500",
        text: "text-amber-900",
        itemBg: "bg-amber-50",
        itemBorder: "border-amber-100",
    },
    blue: {
        bg: "from-blue-50 to-indigo-50",
        border: "border-blue-200",
        iconBg: "bg-blue-500",
        text: "text-blue-900",
        itemBg: "bg-blue-50",
        itemBorder: "border-blue-100",
    },
    purple: {
        bg: "from-purple-50 to-violet-50",
        border: "border-purple-200",
        iconBg: "bg-purple-500",
        text: "text-purple-900",
        itemBg: "bg-purple-50",
        itemBorder: "border-purple-100",
    },
};

function InsightSection({ title, items, icon, colorScheme, defaultOpen = true }: InsightSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const scheme = colorSchemes[colorScheme];

    if (items.length === 0) return null;

    return (
        <div className={`rounded-xl border ${scheme.border} overflow-hidden`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full p-4 bg-linear-to-r ${scheme.bg} flex items-center justify-between hover:opacity-90 transition-opacity`}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 ${scheme.iconBg} rounded-lg text-white`}>
                        {icon}
                    </div>
                    <span className={`font-semibold ${scheme.text}`}>{title}</span>
                    <Badge variant="outline" className="text-xs">
                        {items.length}
                    </Badge>
                </div>
                {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
            </button>

            {isOpen && (
                <div className="p-4 bg-white space-y-2">
                    {items.map((item, index) => (
                        <div
                            key={index}
                            className={`p-3 ${scheme.itemBg} ${scheme.itemBorder} border rounded-lg text-sm text-gray-700 flex items-start gap-2`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${scheme.iconBg} mt-1.5 flex-shrink-0`} />
                            {item}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function InsightsPanel({ insights, className = "", defaultExpanded = true }: InsightsPanelProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const totalInsights =
        insights.risks.length +
        insights.advantages.length +
        insights.marketConsiderations.length +
        insights.strategies.length +
        insights.zoneGuidance.length;

    return (
        <Card className={`border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden ${className}`}>
            <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 border-b">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex items-center justify-between"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-[#1e3a5f] rounded-xl text-white shadow-lg shadow-slate-200">
                            <Lightbulb className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <CardTitle className="text-xl">Business Insights</CardTitle>
                            <p className="text-sm text-gray-500">
                                {totalInsights} insights available
                            </p>
                        </div>
                    </div>
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                </button>
            </CardHeader>

            {isExpanded && (
                <CardContent className="p-6 space-y-4">
                    <InsightSection
                        title="Key Risks"
                        items={insights.risks}
                        icon={<AlertTriangle className="w-4 h-4" />}
                        colorScheme="red"
                    />

                    <InsightSection
                        title="Business Advantages"
                        items={insights.advantages}
                        icon={<TrendingUp className="w-4 h-4" />}
                        colorScheme="green"
                    />

                    <InsightSection
                        title="Market Considerations"
                        items={insights.marketConsiderations}
                        icon={<Lightbulb className="w-4 h-4" />}
                        colorScheme="amber"
                    />

                    <InsightSection
                        title="Recommended Strategies"
                        items={insights.strategies}
                        icon={<Target className="w-4 h-4" />}
                        colorScheme="blue"
                    />

                    <InsightSection
                        title="Zone-based Guidance"
                        items={insights.zoneGuidance}
                        icon={<MapPin className="w-4 h-4" />}
                        colorScheme="purple"
                    />
                </CardContent>
            )}
        </Card>
    );
}

/**
 * Generate insights panel data from opportunity metrics
 */
export function generateInsightsPanelData(
    category: string,
    zoneType: string,
    businessDensity: number,
    competitorDensity: number,
    score: number
): InsightsPanelData {
    const insights: InsightsPanelData = {
        risks: [],
        advantages: [],
        marketConsiderations: [],
        strategies: [],
        zoneGuidance: [],
    };

    // Risk analysis
    if (competitorDensity >= 5) {
        insights.risks.push("High competitor density may lead to price competition");
    }
    if (competitorDensity >= 8) {
        insights.risks.push("Market saturation risk - differentiation is critical");
    }
    if (businessDensity < 5) {
        insights.risks.push("Low foot traffic may affect initial customer acquisition");
    }

    // Advantages
    if (competitorDensity === 0) {
        insights.advantages.push("No direct competitors - opportunity to establish market presence");
    }
    if (competitorDensity <= 2) {
        insights.advantages.push("Low competition provides room for growth");
    }
    if (businessDensity >= 15) {
        insights.advantages.push("High business activity indicates strong local economy");
    }
    if (score >= 70) {
        insights.advantages.push("High opportunity score suggests favorable conditions");
    }

    // Market considerations
    const safeCategory = category || "Business";
    if (businessDensity >= 10) {
        insights.marketConsiderations.push("Strong business ecosystem for potential partnerships");
    }
    insights.marketConsiderations.push(`${safeCategory} segment shows consistent local demand`);
    if (competitorDensity >= 3 && competitorDensity <= 5) {
        insights.marketConsiderations.push("Moderate competition validates market viability");
    }

    // Strategies
    if (competitorDensity >= 5) {
        insights.strategies.push("Focus on unique value proposition and service quality");
        insights.strategies.push("Consider niche positioning or specialty offerings");
    } else {
        insights.strategies.push("First-mover advantage - establish brand recognition early");
    }
    if (businessDensity >= 10) {
        insights.strategies.push("Leverage complementary business foot traffic");
    }
    insights.strategies.push("Build community relationships for repeat customers");

    // Zone guidance
    const normalizedZone = zoneType?.toLowerCase() || "";
    if (normalizedZone.includes("commercial")) {
        insights.zoneGuidance.push("Extended hours recommended for after-work customers");
        insights.zoneGuidance.push("Higher visibility - invest in attractive storefront");
    } else if (normalizedZone.includes("residential")) {
        insights.zoneGuidance.push("Focus on convenience and community service");
        insights.zoneGuidance.push("Weekend operations may be more profitable");
    } else {
        insights.zoneGuidance.push("Flexible approach for diverse customer base");
    }

    return insights;
}
