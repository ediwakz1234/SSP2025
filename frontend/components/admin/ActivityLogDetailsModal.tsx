import { X, User, Clock, Activity, MapPin, BarChart3, Briefcase, Database, LogIn, Info } from "lucide-react";
import { Button } from "../ui/button";

interface ActivityLog {
    id: number;
    action: string;
    status?: string;
    user_id?: string | null;
    user_email?: string | null;
    details?: string | null;
    context?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    created_at: string;
}

interface ActivityLogDetailsModalProps {
    log: ActivityLog | null;
    open: boolean;
    onClose: () => void;
}

const ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    user_login: { label: "User Login", icon: LogIn, color: "text-blue-600" },
    user_logout: { label: "User Logout", icon: LogIn, color: "text-gray-600" },
    clustering_analysis: { label: "Clustering Analysis", icon: BarChart3, color: "text-purple-600" },
    seed_data_reset: { label: "Seed Data Reset", icon: Database, color: "text-orange-600" },
    seed_data_updated: { label: "Seed Data Updated", icon: Database, color: "text-green-600" },
    user_approved: { label: "User Approved", icon: User, color: "text-green-600" },
    user_declined: { label: "User Declined", icon: User, color: "text-red-600" },
    database_migration: { label: "Database Migration", icon: Database, color: "text-indigo-600" },
};

export function ActivityLogDetailsModal({ log, open, onClose }: ActivityLogDetailsModalProps) {
    if (!open || !log) return null;

    const actionConfig = ACTION_CONFIG[log.action] || {
        label: log.action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
        icon: Activity,
        color: "text-gray-600"
    };
    const ActionIcon = actionConfig.icon;

    // Combine context and metadata for display
    const allMetadata = { ...log.context, ...log.metadata };

    // Extract specific fields for better display
    const fullName = allMetadata?.full_name as string | undefined;
    const businessType = allMetadata?.business_type as string | undefined;
    const numClusters = allMetadata?.num_clusters as number | undefined;
    const coordinates = allMetadata?.coordinates as { lat: number; lng: number } | undefined;
    const recommendedLocation = allMetadata?.recommended_location as { lat: number; lng: number } | undefined;
    const targetUserEmail = allMetadata?.target_user_email as string | undefined;
    const targetUserName = allMetadata?.target_user_name as string | undefined;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl animate-fadeInUp overflow-hidden">
                {/* Header */}
                <div className="relative bg-slate-700 p-6 text-white">
                    <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-white/10 blur-2xl -translate-y-1/2 translate-x-1/2" />

                    <div className="relative z-10 flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                <ActionIcon className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">{actionConfig.label}</h2>
                                <p className="text-white/80 text-sm mt-1">Activity Log Details</p>
                            </div>
                        </div>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="text-white/80 hover:text-white hover:bg-white/20"
                            onClick={onClose}
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
                    {/* User Information */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                            <User className="w-4 h-4" />
                            User Information
                        </h3>
                        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                            {(fullName || targetUserName) && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">Full Name</span>
                                    <span className="text-sm font-medium text-gray-900">{fullName || targetUserName}</span>
                                </div>
                            )}
                            {(log.user_email || targetUserEmail) && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">Email</span>
                                    <span className="text-sm font-medium text-gray-900">{log.user_email || targetUserEmail}</span>
                                </div>
                            )}
                            {log.user_id && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">User ID</span>
                                    <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                        {log.user_id.slice(0, 8)}...
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Timestamp */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Timestamp
                        </h3>
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-sm font-medium text-gray-900">
                                {new Date(log.created_at).toLocaleString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                })}
                            </p>
                        </div>
                    </div>

                    {/* Details */}
                    {log.details && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                Details
                            </h3>
                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                                <p className="text-sm text-gray-700">{log.details}</p>
                            </div>
                        </div>
                    )}

                    {/* Business Type */}
                    {businessType && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                                <Briefcase className="w-4 h-4" />
                                Business Type
                            </h3>
                            <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                                <p className="text-sm font-medium text-purple-700">{businessType}</p>
                            </div>
                        </div>
                    )}

                    {/* Clustering Results (for clustering_analysis action) */}
                    {log.action === "clustering_analysis" && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" />
                                Clustering Results
                            </h3>
                            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-4 border border-purple-100 space-y-3">
                                {numClusters && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-500">Number of Clusters</span>
                                        <span className="text-lg font-bold text-purple-600">{numClusters}</span>
                                    </div>
                                )}
                                {coordinates && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-500">Analyzed Coordinates</span>
                                        <span className="text-sm font-mono text-gray-600 bg-white px-2 py-1 rounded">
                                            {coordinates.lat?.toFixed(6)}, {coordinates.lng?.toFixed(6)}
                                        </span>
                                    </div>
                                )}
                                {recommendedLocation && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-500 flex items-center gap-1">
                                            <MapPin className="w-3 h-3" />
                                            Suggested Location
                                        </span>
                                        <span className="text-sm font-mono text-green-600 bg-green-50 px-2 py-1 rounded">
                                            {recommendedLocation.lat?.toFixed(6)}, {recommendedLocation.lng?.toFixed(6)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* All Metadata */}
                    {Object.keys(allMetadata).length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                                <Database className="w-4 h-4" />
                                Full Metadata
                            </h3>
                            <div className="bg-gray-50 rounded-xl p-4 border overflow-hidden">
                                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                                    {Object.entries(allMetadata).map(([key, value]) => (
                                        <div key={key} className="flex items-start gap-2 text-xs">
                                            <span className="font-medium text-gray-500 uppercase tracking-wide min-w-[100px] break-words">
                                                {key.replace(/_/g, ' ')}:
                                            </span>
                                            <span className="text-gray-800 break-all">
                                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t p-4 bg-gray-50">
                    <Button
                        className="w-full"
                        variant="outline"
                        onClick={onClose}
                    >
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}
