/**
 * Time-Based Gaps Utilities
 * 
 * Generates time-based coverage insights from K-Means clustering data.
 * Used in the Market Gaps tab of the OpportunitiesPage dashboard.
 */

// ============================================================================
// Types
// ============================================================================

export interface TimePeriodMetrics {
    businessCount: number;
    mainCategories: string[];
    averageDemandScore: number;
    typicalHours: string;
}

export interface TimePeriodGap {
    period: string;
    status: "Well Covered" | "Gap Identified" | "No Data Available";
    statusColor: "green" | "red" | "gray";
    summary: string;
    details: TimePeriodMetrics;
    insight: string;
    reason: string;
}

export interface TimeBasedGapsResult {
    location: string;
    morning: TimePeriodGap;
    evening: TimePeriodGap;
    overallAssessment: {
        gapsFound: boolean;
        summary: string;
        recommendation: string;
    };
}

export interface ClusterTimeData {
    location: string;
    morning: {
        businessCount: number;
        mainCategories: string[];
        demandScore: number;
        operatingHours: string;
    };
    evening: {
        businessCount: number;
        mainCategories: string[];
        demandScore: number;
        operatingHours: string;
    };
}

// ============================================================================
// Constants
// ============================================================================

// Thresholds for determining coverage status
const COVERAGE_THRESHOLDS = {
    minBusinessCount: 5,        // Minimum businesses to be considered "covered"
    minDemandScore: 50,         // Minimum demand score (0-100)
    balancedRatio: 0.7,         // If supply/demand ratio is above this, it's covered
};

// ============================================================================
// Generator Functions
// ============================================================================

/**
 * Generates time-based gap insights from clustering data
 */
export function generateTimeBasedGaps(data: ClusterTimeData): TimeBasedGapsResult {
    const morning = generateTimePeriodGap("morning", data.morning, "6AM – 11AM");
    const evening = generateTimePeriodGap("evening", data.evening, "6PM – 10PM");

    const gapsFound = morning.status === "Gap Identified" || evening.status === "Gap Identified";

    return {
        location: data.location,
        morning,
        evening,
        overallAssessment: {
            gapsFound,
            summary: gapsFound
                ? "Time-based opportunities were identified in this area."
                : "Both morning and evening periods show sufficient business coverage to meet customer demand in this area.",
            recommendation: gapsFound
                ? "Consider focusing on the underserved time periods for your business operations."
                : "No immediate time-based opportunity detected. Consider exploring other factors such as business category gaps or location-specific opportunities.",
        },
    };
}

/**
 * Generates insight for a specific time period
 */
function generateTimePeriodGap(
    periodType: "morning" | "evening",
    metrics: {
        businessCount: number;
        mainCategories: string[];
        demandScore: number;
        operatingHours: string;
    },
    periodLabel: string
): TimePeriodGap {
    const { businessCount, mainCategories, demandScore, operatingHours } = metrics;

    // Determine if this period is well covered
    const isWellCovered = businessCount >= COVERAGE_THRESHOLDS.minBusinessCount &&
        demandScore >= COVERAGE_THRESHOLDS.minDemandScore;

    const status: "Well Covered" | "Gap Identified" = isWellCovered ? "Well Covered" : "Gap Identified";
    const statusColor: "green" | "red" = isWellCovered ? "green" : "red";

    // Generate human-readable summary
    const summary = isWellCovered
        ? `${periodType === "morning" ? "Morning" : "Evening"} demand is adequately served by local businesses.`
        : `${periodType === "morning" ? "Morning" : "Evening"} period shows limited business coverage.`;

    // Generate insight based on data
    const categoriesText = mainCategories.length > 0
        ? mainCategories.slice(0, 2).join(" and ")
        : "various businesses";

    const insight = isWellCovered
        ? `There are ${businessCount} businesses serving ${periodType} customers, mostly ${categoriesText.toLowerCase()}. ${periodType === "morning" ? "Most open by 6AM, matching early customer demand." : "These establishments remain active during evening hours to serve after-work customers."}`
        : `Only ${businessCount} ${businessCount === 1 ? "business operates" : "businesses operate"} during ${periodType} hours. This creates an opportunity for ${periodType === "morning" ? "breakfast spots, cafes, or early-open services" : "dinner restaurants, entertainment venues, or evening services"}.`;

    // Generate reason
    const reason = isWellCovered
        ? `Supply matches demand. With ${businessCount} businesses and a demand score of ${demandScore}, there is no shortage of options for ${periodType} ${periodType === "morning" ? "shoppers" : "customers"}.`
        : `Limited supply with ${businessCount} ${businessCount === 1 ? "business" : "businesses"} and demand score of ${demandScore} indicates underserved customer needs during this period.`;

    return {
        period: periodLabel,
        status,
        statusColor,
        summary,
        details: {
            businessCount,
            mainCategories,
            averageDemandScore: demandScore,
            typicalHours: operatingHours,
        },
        insight,
        reason,
    };
}

/**
 * Creates default time-based gaps data when no clustering data is available
 */
export function getDefaultTimeBasedGaps(location: string = "Selected Area"): TimeBasedGapsResult {
    return {
        location,
        morning: {
            period: "6AM – 11AM",
            status: "No Data Available",
            statusColor: "gray",
            summary: "Clustering data is required to analyze business coverage during this time period.",
            details: {
                businessCount: 0,
                mainCategories: [],
                averageDemandScore: 0,
                typicalHours: "—",
            },
            insight: "Run clustering to identify time-based opportunities.",
            reason: "No clustering data available yet.",
        },
        evening: {
            period: "6PM – 10PM",
            status: "No Data Available",
            statusColor: "gray",
            summary: "Clustering data is required to analyze business coverage during this time period.",
            details: {
                businessCount: 0,
                mainCategories: [],
                averageDemandScore: 0,
                typicalHours: "—",
            },
            insight: "Run clustering to identify time-based opportunities.",
            reason: "No clustering data available yet.",
        },
        overallAssessment: {
            gapsFound: false,
            summary: "Time-based gap analysis requires clustering data.",
            recommendation: "Run clustering to identify time-based opportunities.",
        },
    };
}

/**
 * Converts raw clustering location data to time-based gap input format
 * This is a helper to bridge existing clustering data with the time-based gaps generator
 */
export function convertClusteringToTimeData(
    location: string,
    locations: Array<{
        general_category: string;
        business_density_200m: number;
        zone_type: string;
    }>,
    categoryDistribution: { name: string; count: number }[]
): ClusterTimeData {
    // Estimate morning vs evening businesses based on category types
    const morningCategories = ["Convenience Store", "Bakery", "Retail", "Services", "Healthcare"];
    const eveningCategories = ["Restaurant", "Food Stall", "Fast Food", "Entertainment", "Bar"];

    // Count businesses likely operating in each period
    let morningCount = 0;
    let eveningCount = 0;
    const morningCats: string[] = [];
    const eveningCats: string[] = [];

    categoryDistribution.forEach(({ name, count }) => {
        const isMorning = morningCategories.some(mc =>
            name.toLowerCase().includes(mc.toLowerCase())
        );
        const isEvening = eveningCategories.some(ec =>
            name.toLowerCase().includes(ec.toLowerCase())
        );

        if (isMorning) {
            morningCount += count;
            if (!morningCats.includes(name)) morningCats.push(name);
        }
        if (isEvening) {
            eveningCount += count;
            if (!eveningCats.includes(name)) eveningCats.push(name);
        }
        // Some businesses operate both periods
        if (!isMorning && !isEvening) {
            morningCount += Math.floor(count * 0.6);
            eveningCount += Math.floor(count * 0.4);
        }
    });

    // Calculate demand scores based on business density
    const avgDensity = locations.length > 0
        ? locations.reduce((sum, loc) => sum + (loc.business_density_200m || 0), 0) / locations.length
        : 0;

    // Normalize density to a 0-100 score
    const baseDemandScore = Math.min(100, Math.round((avgDensity / 20) * 100));

    return {
        location,
        morning: {
            businessCount: morningCount,
            mainCategories: morningCats.slice(0, 3),
            demandScore: Math.min(100, baseDemandScore + 5), // Slightly higher morning demand
            operatingHours: "6AM – 9PM",
        },
        evening: {
            businessCount: eveningCount,
            mainCategories: eveningCats.slice(0, 3),
            demandScore: baseDemandScore,
            operatingHours: "10AM – 10PM",
        },
    };
}
