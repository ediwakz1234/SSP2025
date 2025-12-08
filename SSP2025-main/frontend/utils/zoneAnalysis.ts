/**
 * Zone Analysis Utilities
 * Provides functions for determining best zones and evaluating suitability
 */

// Types
export type ZoneType = "Residential" | "Commercial" | "Mixed" | "Unknown";
export type ZoneSuitability = "Residential" | "Commercial" | "Both";
export type RiskLevel = "Low" | "Medium" | "High";
export type CapitalLevel = "Low" | "Medium" | "High";
export type ProfitabilityLevel = "Low" | "Moderate" | "High" | "Very High";

export interface ZoneAnalysisResult {
    bestZone: ZoneType;
    score: number;
    reasoning: string[];
    competitionLevel: "Low" | "Medium" | "High";
    marketDemand: "Low" | "Medium" | "High";
    accessibility: "Poor" | "Moderate" | "Good" | "Excellent";
}

export interface ZoneSuitabilityResult {
    suitability: ZoneSuitability;
    residentialScore: number;
    commercialScore: number;
    explanation: string;
}

export interface TimeWorkFeasibility {
    recommendedHours: string;
    demandReasoning: string;
    flexibility: "Fixed" | "Flexible" | "Variable";
    peakHours: string[];
    profitImpact: "Low" | "Medium" | "High";
}

export interface EnhancedOpportunity {
    requiredCapital: CapitalLevel;
    expectedProfitability: ProfitabilityLevel;
    riskLevel: RiskLevel;
    suggestedBusinessModel: string;
    timeWorkFeasibility: TimeWorkFeasibility;
    zoneSuitability: ZoneSuitability;
}

/**
 * Determine the best zone based on business metrics
 */
export function determineBestZone(
    businessDensity: number,
    competitorDensity: number,
    zoneType: string,
    category: string
): ZoneAnalysisResult {
    const reasoning: string[] = [];
    let score = 50; // Base score

    // Competition analysis
    let competitionLevel: "Low" | "Medium" | "High" = "Medium";
    if (competitorDensity <= 2) {
        competitionLevel = "Low";
        score += 20;
        reasoning.push("Low competition provides room for market entry");
    } else if (competitorDensity <= 5) {
        competitionLevel = "Medium";
        score += 10;
        reasoning.push("Moderate competition indicates market viability");
    } else {
        competitionLevel = "High";
        score -= 10;
        reasoning.push("High competition requires differentiation strategy");
    }

    // Market demand based on business density
    let marketDemand: "Low" | "Medium" | "High" = "Medium";
    if (businessDensity >= 15) {
        marketDemand = "High";
        score += 15;
        reasoning.push("High business activity suggests strong customer traffic");
    } else if (businessDensity >= 8) {
        marketDemand = "Medium";
        score += 10;
        reasoning.push("Moderate business activity with growth potential");
    } else {
        marketDemand = "Low";
        reasoning.push("Emerging area - first mover advantage available");
    }

    // Zone type analysis
    const normalizedZone = zoneType?.toLowerCase() || "unknown";
    let accessibility: "Poor" | "Moderate" | "Good" | "Excellent" = "Moderate";

    if (normalizedZone.includes("commercial")) {
        score += 15;
        accessibility = "Excellent";
        reasoning.push("Commercial zone offers high visibility and foot traffic");
    } else if (normalizedZone.includes("mixed")) {
        score += 10;
        accessibility = "Good";
        reasoning.push("Mixed zone provides diverse customer base");
    } else if (normalizedZone.includes("residential")) {
        accessibility = "Moderate";
        // Check if category is suitable for residential
        const residentialFriendly = ["Services", "Food & Beverages", "Restaurant", "Retail"];
        const safeCategory = category || "";
        if (residentialFriendly.some(c => safeCategory.includes(c))) {
            score += 5;
            reasoning.push("Residential zone suitable for community-focused business");
        }
    }

    // Determine best zone
    let bestZone: ZoneType = "Mixed";
    if (normalizedZone.includes("commercial")) bestZone = "Commercial";
    else if (normalizedZone.includes("residential")) bestZone = "Residential";
    else if (normalizedZone.includes("mixed")) bestZone = "Mixed";

    return {
        bestZone,
        score: Math.min(100, Math.max(0, score)),
        reasoning,
        competitionLevel,
        marketDemand,
        accessibility,
    };
}

/**
 * Evaluate zone suitability for residential vs commercial placement
 */
export function evaluateZoneSuitability(
    category: string,
    businessDensity: number,
    competitorDensity: number
): ZoneSuitabilityResult {
    const safeCategory = category || "";

    // Categories more suited for residential areas
    const residentialCategories = [
        "Services", "Food & Beverages"
    ];

    // Categories more suited for commercial areas
    const commercialCategories = [
        "Restaurant", "Entertainment / Leisure", "Merchandise / Trading"
    ];

    // Categories that work in both
    const flexibleCategories = ["Retail"];

    let residentialScore = 50;
    let commercialScore = 50;

    // Category-based scoring
    if (residentialCategories.some(c => safeCategory.includes(c))) {
        residentialScore += 25;
    }
    if (commercialCategories.some(c => safeCategory.includes(c))) {
        commercialScore += 25;
    }
    if (flexibleCategories.some(c => safeCategory.includes(c))) {
        residentialScore += 15;
        commercialScore += 15;
    }

    // Density adjustments
    if (competitorDensity < 3) {
        residentialScore += 10; // Less competition in residential is good
    }
    if (businessDensity > 10) {
        commercialScore += 15; // High activity suits commercial
    }

    // Determine suitability
    const diff = Math.abs(residentialScore - commercialScore);
    let suitability: ZoneSuitability;
    let explanation: string;

    if (diff < 15) {
        suitability = "Both";
        explanation = `This ${safeCategory || "business"} can thrive in both residential and commercial zones. Residential offers community loyalty while commercial provides higher foot traffic.`;
    } else if (residentialScore > commercialScore) {
        suitability = "Residential";
        explanation = `Residential zones are ideal for ${safeCategory || "this business"} due to community demand, lower competition, and consistent daily customer patterns.`;
    } else {
        suitability = "Commercial";
        explanation = `Commercial zones are recommended for ${safeCategory || "this business"} due to higher visibility, foot traffic, and synergy with surrounding businesses.`;
    }

    return {
        suitability,
        residentialScore: Math.min(100, residentialScore),
        commercialScore: Math.min(100, commercialScore),
        explanation,
    };
}

/**
 * Evaluate time work feasibility based on business type and zone
 */
export function evaluateTimeWorkFeasibility(
    category: string,
    zoneType: string,
    preferredHours?: { start: number; end: number }
): TimeWorkFeasibility {
    const normalizedZone = zoneType?.toLowerCase() || "";
    const safeCategory = category || "";

    // Default peak hours by category
    const categoryPeakHours: Record<string, string[]> = {
        "Restaurant": ["11:00 AM - 2:00 PM", "6:00 PM - 9:00 PM"],
        "Food & Beverages": ["7:00 AM - 10:00 AM", "2:00 PM - 6:00 PM"],
        "Services": ["9:00 AM - 12:00 PM", "2:00 PM - 5:00 PM"],
        "Retail": ["10:00 AM - 12:00 PM", "4:00 PM - 7:00 PM"],
        "Entertainment / Leisure": ["2:00 PM - 5:00 PM", "7:00 PM - 10:00 PM"],
        "Merchandise / Trading": ["9:00 AM - 12:00 PM", "3:00 PM - 6:00 PM"],
    };

    // Find matching category or use default
    const peakHours = Object.entries(categoryPeakHours).find(([key]) =>
        safeCategory.toLowerCase().includes(key.toLowerCase())
    )?.[1] || ["9:00 AM - 12:00 PM", "2:00 PM - 5:00 PM"];

    // Determine flexibility
    let flexibility: "Fixed" | "Flexible" | "Variable" = "Flexible";
    let recommendedHours = "8:00 AM - 6:00 PM";
    let demandReasoning = "";

    if (normalizedZone.includes("commercial")) {
        flexibility = "Fixed";
        recommendedHours = "9:00 AM - 8:00 PM";
        demandReasoning = "Commercial zones have consistent business hours expectations. Extended evening hours recommended for worker convenience.";
    } else if (normalizedZone.includes("residential")) {
        flexibility = "Flexible";
        recommendedHours = "7:00 AM - 7:00 PM";
        demandReasoning = "Residential zones allow flexible hours. Morning and evening peaks when residents are home.";
    } else {
        flexibility = "Variable";
        recommendedHours = "8:00 AM - 8:00 PM";
        demandReasoning = "Mixed zone requires adaptable hours to serve diverse customer patterns.";
    }

    // Adjust for user preferences if provided
    if (preferredHours) {
        const startHour = preferredHours.start;
        const endHour = preferredHours.end;
        const hoursWorked = endHour - startHour;

        if (hoursWorked >= 8) {
            recommendedHours = `${formatHour(startHour)} - ${formatHour(endHour)}`;
        }
    }

    // Determine profit impact
    let profitImpact: "Low" | "Medium" | "High" = "Medium";
    if (["Restaurant", "Entertainment / Leisure"].some(c => safeCategory.includes(c))) {
        profitImpact = "High"; // These are very time-sensitive
    } else if (["Services"].some(c => safeCategory.includes(c))) {
        profitImpact = "Low"; // More consistent throughout day
    }

    return {
        recommendedHours,
        demandReasoning,
        flexibility,
        peakHours,
        profitImpact,
    };
}

/**
 * Format hour number to readable string
 */
function formatHour(hour: number): string {
    if (hour === 12) return "12:00 PM";
    if (hour === 0 || hour === 24) return "12:00 AM";
    if (hour < 12) return `${hour}:00 AM`;
    return `${hour - 12}:00 PM`;
}

/**
 * Determine required capital based on category and zone
 */
export function estimateRequiredCapital(category: string, zoneType: string): CapitalLevel {
    const highCapitalCategories = ["Restaurant", "Entertainment / Leisure"];
    const lowCapitalCategories = ["Services"];
    const safeCategory = category || "";

    const normalizedZone = zoneType?.toLowerCase() || "";
    const isCommercial = normalizedZone.includes("commercial");

    if (highCapitalCategories.some(c => safeCategory.includes(c))) {
        return "High";
    }
    if (lowCapitalCategories.some(c => safeCategory.includes(c))) {
        return isCommercial ? "Medium" : "Low";
    }
    return isCommercial ? "Medium" : "Low";
}

/**
 * Estimate profitability based on various factors
 */
export function estimateProfitability(
    businessDensity: number,
    competitorDensity: number,
    category: string
): ProfitabilityLevel {
    // Base on competition ratio
    const ratio = businessDensity / (competitorDensity + 1);
    const safeCategory = category || "";

    // High growth categories
    const highGrowthCategories = ["Food & Beverages", "Services", "Restaurant"];
    const isHighGrowth = highGrowthCategories.some(c => safeCategory.includes(c));

    if (ratio >= 5 && isHighGrowth) {
        return "Very High";
    }
    if (ratio >= 3 || (ratio >= 2 && isHighGrowth)) {
        return "High";
    }
    if (ratio >= 1.5) {
        return "Moderate";
    }
    return "Low";
}

/**
 * Assess risk level based on competition and market factors
 */
export function assessRiskLevel(
    competitorDensity: number,
    category: string
): RiskLevel {
    const safeCategory = category || "";
    // Higher risk categories
    const highRiskCategories = ["Restaurant", "Entertainment / Leisure"];
    const isHighRisk = highRiskCategories.some(c => safeCategory.includes(c));

    if (competitorDensity >= 8 || (competitorDensity >= 5 && isHighRisk)) {
        return "High";
    }
    if (competitorDensity >= 3 || isHighRisk) {
        return "Medium";
    }
    return "Low";
}

/**
 * Suggest business model based on analysis
 */
export function suggestBusinessModel(
    category: string,
    zoneType: string,
    competitorDensity: number
): string {
    const normalizedZone = zoneType?.toLowerCase() || "";
    const safeCategory = category || "";

    const models: Record<string, string[]> = {
        "Restaurant": ["Fast-casual dining", "Cloud kitchen with delivery", "Specialty cuisine"],
        "Food & Beverages": ["Quick-service cafe", "Specialty drinks bar", "Grab-and-go concept"],
        "Services": ["Mobile/on-demand service", "Subscription-based", "Premium boutique service"],
        "Retail": ["Convenience store format", "Specialty/niche retail", "Hybrid retail-service"],
        "Entertainment / Leisure": ["Experience-based venue", "Membership model", "Event-focused"],
        "Merchandise / Trading": ["Wholesale-retail hybrid", "Specialty trading", "E-commerce enabled"],
    };

    const categoryModels = Object.entries(models).find(([key]) =>
        safeCategory.toLowerCase().includes(key.toLowerCase())
    )?.[1] || ["Standard retail model", "Service-focused", "Hybrid approach"];

    // Choose based on competition
    if (competitorDensity >= 5) {
        return categoryModels[0] + " with differentiation focus";
    } else if (normalizedZone.includes("residential")) {
        return categoryModels[1] + " for community needs";
    }
    return categoryModels[2];
}

/**
 * Generate zone-based insights
 */
export function generateZoneInsights(
    zoneType: string,
    category: string,
    businessDensity: number,
    competitorDensity: number
): string[] {
    const insights: string[] = [];
    const normalizedZone = zoneType?.toLowerCase() || "";

    // Zone-specific insights
    if (normalizedZone.includes("commercial")) {
        insights.push("Expect higher rental costs but better foot traffic");
        insights.push("Consider extended operating hours for after-work customers");
    } else if (normalizedZone.includes("residential")) {
        insights.push("Focus on building community relationships for repeat customers");
        insights.push("Weekend hours may be more profitable than weekdays");
    } else {
        insights.push("Mixed zone offers flexibility in customer targeting");
    }

    // Competition insights
    if (competitorDensity === 0) {
        insights.push("No direct competitors - establish market presence quickly");
    } else if (competitorDensity <= 2) {
        insights.push("Low competition - opportunity to capture market share");
    } else if (competitorDensity >= 5) {
        insights.push("High competition - differentiation and quality are key");
    }

    // Density insights
    if (businessDensity >= 15) {
        insights.push("High business activity indicates strong local economy");
    } else if (businessDensity < 5) {
        insights.push("Emerging area - potential for growth as first mover");
    }

    return insights;
}
