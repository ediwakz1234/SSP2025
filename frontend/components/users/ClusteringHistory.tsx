import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
    Clock,
    MapPin,
    TrendingUp,
    Calendar,
    ChevronRight,
    History,
    Target,
    RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

export interface ClusteringHistoryItem {
    id: string;
    business_category: string;
    business_idea?: string;
    created_at: string;
    zone_type: string;
    opportunity: string;
    opportunity_score: number;
    confidence: number;
    num_clusters: number;
    recommended_lat: number;
    recommended_lng: number;
    locations: Array<{
        street: string;
        general_category: string;
        business_density_200m: number;
        competitor_density_200m: number;
        zone_type: string;
        cluster: number;
        score: number;
    }>;
}

interface ClusteringHistoryProps {
    onSelectHistory?: (item: ClusteringHistoryItem) => void;
    maxItems?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getCompetitionLevel(score: number): { label: string; color: string } {
    if (score >= 70) return { label: "Low", color: "bg-emerald-100 text-emerald-700" };
    if (score >= 40) return { label: "Medium", color: "bg-amber-100 text-amber-700" };
    return { label: "High", color: "bg-rose-100 text-rose-700" };
}

function generateBusinessIdeaLabel(item: ClusteringHistoryItem): string {
    // If business_idea exists, use it
    if (item.business_idea) return item.business_idea;

    // Otherwise generate from category and zone
    const category = item.business_category || "Business";
    const zone = (item.zone_type || "").toLowerCase();

    let timePrefix = "All-Day";
    if (zone.includes("commercial")) {
        timePrefix = "All-Day";
    } else if (zone.includes("residential")) {
        timePrefix = "Morning";
    }

    // Map categories to simpler business type names
    const categoryMap: Record<string, string> = {
        "Food & Beverages": "Cafe",
        "Restaurant": "Food Stall",
        "Retail": "Convenience Store",
        "Services": "Service Business",
        "Merchandising / Trading": "Trading Store",
        "Entertainment / Leisure": "Entertainment",
    };

    const businessType = categoryMap[category] || category;
    return `${timePrefix} ${businessType}`;
}

// ============================================================================
// Component
// ============================================================================

export function ClusteringHistory({ onSelectHistory, maxItems = 10 }: ClusteringHistoryProps) {
    const [history, setHistory] = useState<ClusteringHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadHistory = async () => {
        setLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from("clustering_opportunities")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(maxItems);

            if (fetchError) {
                throw fetchError;
            }

            setHistory(data || []);
        } catch (err) {
            console.error("Error loading clustering history:", err);
            setError("Failed to load history");
            toast.error("Failed to load clustering history");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, [maxItems]);

    // Group history by business idea
    const groupedHistory = history.reduce((acc, item) => {
        const idea = generateBusinessIdeaLabel(item);
        if (!acc[idea]) {
            acc[idea] = [];
        }
        acc[idea].push(item);
        return acc;
    }, {} as Record<string, ClusteringHistoryItem[]>);

    if (loading) {
        return (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                <CardContent className="p-8">
                    <div className="flex items-center justify-center gap-3">
                        <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                        <span className="text-gray-600">Loading history...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                <CardContent className="p-8">
                    <div className="text-center">
                        <p className="text-gray-500 mb-4">{error}</p>
                        <Button variant="outline" onClick={loadHistory}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Try Again
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (history.length === 0) {
        return (
            <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                <CardHeader className="bg-linear-to-r from-slate-50 to-gray-50 border-b">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-linear-to-br from-slate-500 to-gray-600 rounded-xl text-white shadow-lg">
                            <History className="w-5 h-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Clustering History</CardTitle>
                            <p className="text-sm text-gray-500">Your past analyses</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="text-center py-8">
                        <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500">No clustering runs yet.</p>
                        <p className="text-sm text-gray-400 mt-1">
                            Run a clustering analysis to see history here.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-linear-to-r from-indigo-50 to-purple-50 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-linear-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-200">
                            <History className="w-5 h-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Clustering History</CardTitle>
                            <p className="text-sm text-gray-500">{history.length} past analyses</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={loadHistory}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <div className="space-y-6">
                    {Object.entries(groupedHistory).map(([idea, items]) => (
                        <div key={idea} className="space-y-3">
                            {/* Business Idea Group Header */}
                            <div className="flex items-center gap-2">
                                <Target className="w-4 h-4 text-indigo-500" />
                                <span className="font-semibold text-gray-800">{idea}</span>
                                <Badge variant="outline" className="text-xs">
                                    {items.length} {items.length === 1 ? "run" : "runs"}
                                </Badge>
                            </div>

                            {/* History Items */}
                            <div className="space-y-2 pl-6">
                                {items.map((item) => {
                                    const competition = getCompetitionLevel(item.opportunity_score);

                                    return (
                                        <div
                                            key={item.id}
                                            className="p-4 rounded-xl border bg-white hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group"
                                            onClick={() => onSelectHistory?.(item)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Badge className="bg-indigo-100 text-indigo-700 border-0">
                                                            {item.business_category}
                                                        </Badge>
                                                        <Badge className={`border-0 ${competition.color}`}>
                                                            {competition.label} Competition
                                                        </Badge>
                                                    </div>

                                                    <div className="flex items-center gap-4 text-sm text-gray-500">
                                                        <span className="flex items-center gap-1">
                                                            <MapPin className="w-3 h-3" />
                                                            {item.zone_type}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <TrendingUp className="w-3 h-3" />
                                                            {item.locations?.length || 0} opportunities
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {formatDate(item.created_at)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

export default ClusteringHistory;
