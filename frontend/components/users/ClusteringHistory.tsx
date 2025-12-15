import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
    MapPin,
    TrendingUp,
    Calendar,
    History,
    Target,
    RefreshCw,
    RotateCcw,
    Check,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useKMeansStore } from "../../lib/stores/kmeansStore";

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
    if (item.business_idea) return item.business_idea;

    const category = item.business_category || "Business";
    const zone = (item.zone_type || "").toLowerCase();

    let timePrefix = "All-Day";
    if (zone.includes("commercial")) {
        timePrefix = "All-Day";
    } else if (zone.includes("residential")) {
        timePrefix = "Morning";
    }

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
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Get active version from store
    const activeVersionId = useKMeansStore((state) => state.activeVersionId);
    const restoreFromHistory = useKMeansStore((state) => state.restoreFromHistory);

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

    // Handle delete action
    const handleDelete = async (item: ClusteringHistoryItem, versionNumber: number, e: React.MouseEvent) => {
        e.stopPropagation();

        // Confirm before deleting
        if (!window.confirm(`Delete v${versionNumber} (${item.business_category})? This cannot be undone.`)) {
            return;
        }

        setDeletingId(item.id);

        try {
            const { error: deleteError } = await supabase
                .from("clustering_opportunities")
                .delete()
                .eq("id", item.id);

            if (deleteError) {
                throw deleteError;
            }

            toast.success(`Deleted v${versionNumber}`, {
                description: `${item.business_category} removed from history`,
            });

            // Reload history after deletion
            await loadHistory();
        } catch (err) {
            console.error("Error deleting history item:", err);
            toast.error("Failed to delete history item");
        } finally {
            setDeletingId(null);
        }
    };

    // Handle restore action
    const handleRestore = async (item: ClusteringHistoryItem, versionNumber: number, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click

        setRestoringId(item.id);

        try {
            // Restore from history using kmeansStore
            restoreFromHistory({
                id: item.id,
                versionNumber,
                businessIdea: item.business_idea || generateBusinessIdeaLabel(item),
                category: item.business_category,
                zoneType: item.zone_type,
                analysis: {
                    opportunity: item.opportunity,
                    opportunity_score: item.opportunity_score,
                    confidence: item.confidence,
                    competitorCount: 0,
                },
                locations: item.locations || [],
            });

            toast.success(`Restored v${versionNumber}`, {
                description: `${item.business_category} - ${item.locations?.length || 0} opportunities`,
            });

            // Call parent handler if provided
            onSelectHistory?.(item);
        } catch (err) {
            console.error("Error restoring version:", err);
            toast.error("Failed to restore version");
        } finally {
            setRestoringId(null);
        }
    };

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
                            <p className="text-sm text-gray-500">{history.length} versions saved</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={loadHistory}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <div className="space-y-3">
                    {history.map((item, index) => {
                        const versionNumber = history.length - index;
                        const competition = getCompetitionLevel(item.opportunity_score);
                        const isActive = activeVersionId === item.id;
                        const isRestoring = restoringId === item.id;
                        const businessIdea = generateBusinessIdeaLabel(item);

                        return (
                            <div
                                key={item.id}
                                className={`p-4 rounded-xl border transition-all ${isActive
                                    ? "border-indigo-400 bg-indigo-50/50 shadow-md"
                                    : "bg-white hover:border-indigo-200 hover:shadow-md"
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        {/* Version and Business Idea */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge className={`font-bold ${isActive ? "bg-indigo-500 text-white" : "bg-gray-200 text-gray-700"}`}>
                                                v{versionNumber}
                                            </Badge>
                                            <span className="font-semibold text-gray-800 flex items-center gap-1">
                                                <Target className="w-3 h-3 text-indigo-500" />
                                                {businessIdea}
                                            </span>
                                            {isActive && (
                                                <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                                                    <Check className="w-3 h-3 mr-1" />
                                                    Active
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Category and Competition */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge className="bg-indigo-100 text-indigo-700 border-0">
                                                {item.business_category}
                                            </Badge>
                                            <Badge className={`border-0 ${competition.color}`}>
                                                {competition.label} Competition
                                            </Badge>
                                        </div>

                                        {/* Details */}
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

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 ml-4">
                                        {!isActive && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700"
                                                onClick={(e) => handleRestore(item, versionNumber, e)}
                                                disabled={isRestoring || deletingId === item.id}
                                            >
                                                {isRestoring ? (
                                                    <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                                ) : (
                                                    <RotateCcw className="w-4 h-4 mr-1" />
                                                )}
                                                Restore
                                            </Button>
                                        )}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                                            onClick={(e) => handleDelete(item, versionNumber, e)}
                                            disabled={deletingId === item.id || isRestoring}
                                        >
                                            {deletingId === item.id ? (
                                                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4 mr-1" />
                                            )}
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

export default ClusteringHistory;

