/**
 * Business Idea Generator
 * 
 * Generates short, clear business ideas from clustering data.
 * Used to label clustering history entries.
 */

// ============================================================================
// Types
// ============================================================================

export interface BusinessIdeaParams {
    category: string;
    zoneType: string;
    opportunityLevel?: string;
    confidence?: number;
    dominantCategories?: string[];
    operatingTime?: "Morning" | "Evening" | "All-Day";
}

// ============================================================================
// Constants
// ============================================================================

// Category to business type mappings
const CATEGORY_BUSINESS_TYPES: Record<string, string[]> = {
    "Food & Beverages": ["Cafe", "Coffee Shop", "Juice Bar", "Snack Stand"],
    "Restaurant": ["Eatery", "Food Stall", "Carinderia", "Fast Food"],
    "Retail": ["Convenience Store", "Sari-Sari Store", "Mini Mart", "Retail Shop"],
    "Services": ["Service Center", "Laundry", "Repair Shop", "Salon"],
    "Merchandising / Trading": ["Trading Post", "Wholesale", "Merchandise Store"],
    "Entertainment / Leisure": ["Entertainment Hub", "Arcade", "Recreation Center"],
};

// Zone type to operating time suggestions
const ZONE_OPERATING_TIME: Record<string, "Morning" | "Evening" | "All-Day"> = {
    "Commercial Zone": "All-Day",
    "Residential Zone": "Morning",
    "Mixed Zone": "All-Day",
};

// ============================================================================
// Generator Functions
// ============================================================================

/**
 * Generates a short, clear business idea label from clustering parameters
 */
export function generateBusinessIdea(params: BusinessIdeaParams): string {
    const { category, zoneType, opportunityLevel, confidence, operatingTime } = params;

    // Determine operating time prefix
    let timePrefix = operatingTime || ZONE_OPERATING_TIME[zoneType] || "All-Day";

    // Adjust based on confidence - low confidence suggests niche/less competitive times
    if (confidence !== undefined && confidence < 0.5) {
        // Low confidence areas might benefit from off-peak hours
        timePrefix = timePrefix === "All-Day" ? "Evening" : timePrefix;
    }

    // Get business type based on category
    const categoryTypes = CATEGORY_BUSINESS_TYPES[category] || ["Business"];
    const businessType = categoryTypes[0]; // Use first/primary type

    // Build the business idea
    const parts: string[] = [];

    // Add time prefix
    parts.push(timePrefix);

    // Add business type
    parts.push(businessType);

    // Special cases based on opportunity level
    if (opportunityLevel?.toLowerCase().includes("high")) {
        // High opportunity - can be more specific
        return parts.join(" ");
    }

    return parts.join(" ");
}

/**
 * Generates a detailed business idea with location context
 */
export function generateDetailedBusinessIdea(params: BusinessIdeaParams & {
    locationName?: string;
}): {
    shortIdea: string;
    description: string;
    recommendedHours: string;
} {
    const shortIdea = generateBusinessIdea(params);
    const { category: _category, zoneType, confidence: _confidence } = params;

    // Generate description
    let description = `A ${shortIdea.toLowerCase()} `;

    if (zoneType?.includes("Commercial")) {
        description += "targeting commuters and workers in the commercial district.";
    } else if (zoneType?.includes("Residential")) {
        description += "serving the local residential community.";
    } else {
        description += "catering to mixed traffic in the area.";
    }

    // Determine recommended hours
    let recommendedHours = "8AM – 8PM";
    if (shortIdea.includes("Morning")) {
        recommendedHours = "6AM – 12PM";
    } else if (shortIdea.includes("Evening")) {
        recommendedHours = "4PM – 10PM";
    }

    return {
        shortIdea,
        description,
        recommendedHours,
    };
}

/**
 * Generates business idea from clustering result data
 */
export function generateBusinessIdeaFromClustering(data: {
    category: string;
    zoneType: string;
    confidence: number;
    opportunityScore?: number;
    nearbyBusinesses?: Array<{ business: { general_category: string } }>;
}): string {
    const { category, zoneType, confidence, nearbyBusinesses } = data;

    // Determine dominant categories from nearby businesses if available
    let operatingTime: "Morning" | "Evening" | "All-Day" = "All-Day";

    if (nearbyBusinesses && nearbyBusinesses.length > 0) {
        // Count food-related businesses (tend to be evening)
        const foodCount = nearbyBusinesses.filter(
            nb => nb.business.general_category?.toLowerCase().includes("food") ||
                nb.business.general_category?.toLowerCase().includes("restaurant")
        ).length;

        // Count retail/service businesses (tend to be daytime)
        const retailCount = nearbyBusinesses.filter(
            nb => nb.business.general_category?.toLowerCase().includes("retail") ||
                nb.business.general_category?.toLowerCase().includes("service")
        ).length;

        if (foodCount > retailCount * 1.5) {
            operatingTime = "Evening";
        } else if (retailCount > foodCount * 1.5) {
            operatingTime = "Morning";
        }
    }

    return generateBusinessIdea({
        category,
        zoneType,
        confidence,
        operatingTime,
        opportunityLevel: data.opportunityScore && data.opportunityScore > 70 ? "High" : "Moderate",
    });
}
