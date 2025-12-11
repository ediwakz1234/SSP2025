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

interface Top3Business {
    name: string;
    score: number;
    fit_percentage: number;
    opportunity_level: string;
    reason: string;
}

interface ClusterSummaryItem {
    cluster_id: number;
    business_count: number;
    competition: string;
}

interface AIBusinessRecommendations {
    best_cluster: {
        cluster_id: string;
        reason: string;
    };
    top_3_businesses: Top3Business[];
    cluster_summary: ClusterSummaryItem[];
    final_suggestion: string;
    confidence: number;
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
};

// Create in-memory Zustand store (NO persistence)
export const useKMeansStore = create<KMeansStore>((set) => ({
    ...initialState,

    setBusinessIdea: (value) => set({ businessIdea: value }),

    setDetectedCategory: (value, reason = '') => set({
        detectedCategory: value,
        categoryReason: reason,
    }),

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
        analysisTimestamp: Date.now(),
    }),

    setAIRecommendations: (recommendations) => set({
        aiRecommendations: recommendations,
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
}));
