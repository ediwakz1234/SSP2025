import { create } from 'zustand';

// Types for K-Means store
interface ClusterResult {
    id: number;
    centroid: { latitude: number; longitude: number };
    points: Array<{
        latitude: number;
        longitude: number;
        business: {
            business_id: string;
            business_name: string;
            general_category: string;
            street: string;
            zone_type: string;
            business_density_200m?: number;
            competitor_density_200m?: number;
        };
    }>;
    color: string;
}

interface NearbyBusiness {
    business: {
        business_id: string;
        business_name: string;
        general_category: string;
        street: string;
        zone_type: string;
    };
    distance: number;
}

interface TopBusiness {
    name: string;
    score: number;
    fitPercentage: number;
    opportunityLevel: string;
    shortDescription: string;
    fullDetails: string;
    preferredLocation: string;
    startupBudget: string;
    competitorPresence: string;
    businessDensityInsight: string;
}

interface ClusterSummaryItem {
    clusterId: number;
    zoneType: string; // "Commercial Zone" | "Residential Zone" | "Mixed Zone"
    friendlyName?: string; // deprecated, use zoneType
    businessCount: number;
    competitionLevel: string;
}

interface AIBusinessRecommendations {
    marketOverview?: {
        overallScore: number;
        opportunityLevel: string;
        competitionLevel: string;
        marketSaturationPercent: number;
        marketSaturationStatus: string;
        areaReadiness: string;
        zoneType: string;
        summary: string;
    };
    ideaFit?: {
        ideaFitScore: number;
        fitLabel: string;
        competitionForIdea: string;
        riskLevel: string;
        setupDifficulty: string;
        suggestedAdjustments: string;
    };
    bestCluster: {
        clusterId: number;
        friendlyName: string;
        zoneType?: string;
        reason: string;
        confidence: number;
        confidenceLabel: string;
        confidenceColor: string;
    };
    topBusinesses: TopBusiness[];
    clusterSummary: ClusterSummaryItem[];
    finalSuggestion: string;
}

interface ClusteringAnalysis {
    opportunity: string;
    opportunity_score: number;
    confidence: number;
    competitorCount: number;
}

interface CompetitorAnalysis {
    competitorsWithin500m: number;
    competitorsWithin1km: number;
    competitorsWithin2km: number;
    nearestCompetitor: {
        business_name: string;
        street: string;
    } | null;
    distanceToNearest: number;
    marketSaturation: number;
    recommendedStrategy: string;
}

interface RecommendedLocation {
    latitude: number;
    longitude: number;
}

// Version snapshot for restore functionality
export interface ClusteringVersion {
    id: string;
    version: number;
    businessIdea: string;
    category: string;
    zoneType: string;
    opportunityScore: number;
    confidence: number;
    opportunityCount: number;
    createdAt: string;
}

// Full K-Means session state
interface KMeansState {
    // User inputs
    businessIdea: string;
    detectedCategory: string;
    categoryReason: string;

    // Clustering results
    hasResults: boolean;
    recommendedLocation: RecommendedLocation | null;
    clusters: ClusterResult[];
    zoneType: string;
    analysis: ClusteringAnalysis | null;
    competitorAnalysis: CompetitorAnalysis | null;
    nearbyBusinesses: NearbyBusiness[];

    // Density metrics
    businessDensity: { r50: number; r100: number; r200: number } | null;
    competitorDensity: { r50: number; r100: number; r200: number } | null;

    // AI recommendations
    aiRecommendations: AIBusinessRecommendations | null;

    // Timestamp to know when analysis was run
    analysisTimestamp: number | null;

    // Version tracking
    activeVersionId: string | null;
    versionNumber: number;
}

interface KMeansActions {
    // Individual setters
    setBusinessIdea: (value: string) => void;
    setDetectedCategory: (value: string, reason?: string) => void;

    // Bulk setter for clustering results
    setClusteringResults: (results: {
        recommendedLocation: RecommendedLocation;
        clusters: ClusterResult[];
        zoneType: string;
        analysis: ClusteringAnalysis;
        competitorAnalysis: CompetitorAnalysis;
        nearbyBusinesses: NearbyBusiness[];
        businessDensity?: { r50: number; r100: number; r200: number };
        competitorDensity?: { r50: number; r100: number; r200: number };
    }) => void;

    // AI recommendations setter
    setAIRecommendations: (recommendations: AIBusinessRecommendations) => void;

    // Version management
    setActiveVersion: (id: string, versionNumber: number) => void;
    incrementVersion: () => number;

    // Restore from history (load saved data without re-running clustering)
    restoreFromHistory: (data: {
        id: string;
        versionNumber: number;
        businessIdea: string;
        category: string;
        zoneType: string;
        analysis: ClusteringAnalysis;
        locations: Array<{
            street: string;
            general_category: string;
            business_density_200m: number;
            competitor_density_200m: number;
            zone_type: string;
            cluster: number;
            score: number;
        }>;
    }) => void;

    // Reset all state (for logout)
    reset: () => void;
}

type KMeansStore = KMeansState & KMeansActions;

// Initial state
const initialState: KMeansState = {
    businessIdea: '',
    detectedCategory: '',
    categoryReason: '',
    hasResults: false,
    recommendedLocation: null,
    clusters: [],
    zoneType: '',
    analysis: null,
    competitorAnalysis: null,
    nearbyBusinesses: [],
    businessDensity: null,
    competitorDensity: null,
    aiRecommendations: null,
    analysisTimestamp: null,
    activeVersionId: null,
    versionNumber: 0,
};

// Create in-memory Zustand store (NO persistence)
export const useKMeansStore = create<KMeansStore>((set, get) => ({
    ...initialState,

    // When business idea changes, reset all results to ensure fresh data
    setBusinessIdea: (value) => set({
        businessIdea: value,
        // Clear all previous clustering results and AI recommendations
        hasResults: false,
        recommendedLocation: null,
        clusters: [],
        zoneType: '',
        analysis: null,
        competitorAnalysis: null,
        nearbyBusinesses: [],
        businessDensity: null,
        competitorDensity: null,
        aiRecommendations: null,
        analysisTimestamp: null,
        activeVersionId: null,
    }),

    setDetectedCategory: (value, reason = '') => set({
        detectedCategory: value,
        categoryReason: reason,
    }),

    // When new clustering results are set, clear previous AI recommendations
    setClusteringResults: (results) => set({
        hasResults: true,
        recommendedLocation: results.recommendedLocation,
        clusters: results.clusters,
        zoneType: results.zoneType,
        analysis: results.analysis,
        competitorAnalysis: results.competitorAnalysis,
        nearbyBusinesses: results.nearbyBusinesses,
        businessDensity: results.businessDensity || null,
        competitorDensity: results.competitorDensity || null,
        // Clear old AI recommendations - they will be regenerated
        aiRecommendations: null,
        analysisTimestamp: Date.now(),
    }),

    setAIRecommendations: (recommendations) => set({
        aiRecommendations: recommendations,
    }),

    // Set active version ID
    setActiveVersion: (id, versionNumber) => set({
        activeVersionId: id,
        versionNumber,
    }),

    // Increment and return new version number
    incrementVersion: () => {
        const newVersion = get().versionNumber + 1;
        set({ versionNumber: newVersion });
        return newVersion;
    },

    // Restore dashboard from history without re-running clustering
    restoreFromHistory: (data) => set({
        hasResults: true,
        activeVersionId: data.id,
        versionNumber: data.versionNumber,
        businessIdea: data.businessIdea,
        detectedCategory: data.category,
        zoneType: data.zoneType,
        analysis: data.analysis,
        analysisTimestamp: Date.now(),
        // Note: Full cluster data isn't stored in history, so we mark as restored
        clusters: [],
        nearbyBusinesses: [],
        competitorAnalysis: null,
        aiRecommendations: null,
    }),

    reset: () => set(initialState),
}));

// Selector hooks for specific slices (optional optimization)
export const useKMeansInputs = () => useKMeansStore((state) => ({
    businessIdea: state.businessIdea,
    detectedCategory: state.detectedCategory,
    categoryReason: state.categoryReason,
}));

export const useKMeansResults = () => useKMeansStore((state) => ({
    hasResults: state.hasResults,
    recommendedLocation: state.recommendedLocation,
    clusters: state.clusters,
    zoneType: state.zoneType,
    analysis: state.analysis,
    competitorAnalysis: state.competitorAnalysis,
    nearbyBusinesses: state.nearbyBusinesses,
    aiRecommendations: state.aiRecommendations,
    analysisTimestamp: state.analysisTimestamp,
    activeVersionId: state.activeVersionId,
    versionNumber: state.versionNumber,
}));
