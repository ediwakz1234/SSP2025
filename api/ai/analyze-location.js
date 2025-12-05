/**
 * AI Location Analysis API
 * Evaluates commercial potential of a location using:
 * - Business density (50m, 100m, 200m)
 * - Competitor pressure
 * - Demand patterns
 * - Cluster insights
 */

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const {
            coordinates,
            category,
            businesses = [],
            zoneType = "Unknown",
            clusterInfo = {},
        } = req.body;

        if (!coordinates?.latitude || !coordinates?.longitude) {
            return res.status(400).json({ error: "Coordinates required" });
        }

        const { latitude, longitude } = coordinates;

        // --- CALCULATE DISTANCES ---
        const haversine = (lat1, lon1, lat2, lon2) => {
            const R = 6371; // km
            const dLat = ((lat2 - lat1) * Math.PI) / 180;
            const dLon = ((lon2 - lon1) * Math.PI) / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c * 1000; // meters
        };

        // Categorize businesses by distance
        const businessesWithDistance = businesses.map((b) => ({
            ...b,
            distance: haversine(latitude, longitude, b.latitude, b.longitude),
        }));

        const within50m = businessesWithDistance.filter((b) => b.distance <= 50);
        const within100m = businessesWithDistance.filter((b) => b.distance <= 100);
        const within200m = businessesWithDistance.filter((b) => b.distance <= 200);

        // Get unique categories
        const getCategories = (arr) => {
            if (arr.length === 0) return "none";
            const cats = [...new Set(arr.map((b) => b.general_category || b.category))];
            return cats.slice(0, 5).join(", ") || "none";
        };

        // Identify competitors (same category)
        const competitors50m = within50m.filter(
            (b) => (b.general_category || b.category) === category
        );
        const competitors100m = within100m.filter(
            (b) => (b.general_category || b.category) === category
        );
        const competitors200m = within200m.filter(
            (b) => (b.general_category || b.category) === category
        );

        const getCompetitorNames = (arr) => {
            if (arr.length === 0) return "none";
            return (
                arr
                    .slice(0, 5)
                    .map((b) => b.business_name || "Unknown")
                    .join(", ") || "none"
            );
        };

        // --- BUSINESS PRESENCE ---
        const businessPresence = {
            radius_50m: {
                count: within50m.length,
                categories: getCategories(within50m),
            },
            radius_100m: {
                count: within100m.length,
                categories: getCategories(within100m),
            },
            radius_200m: {
                count: within200m.length,
                categories: getCategories(within200m),
            },
        };

        // --- COMPETITOR PRESSURE ---
        const competitorPressure = {
            radius_50m: {
                count: competitors50m.length,
                names: getCompetitorNames(competitors50m),
            },
            radius_100m: {
                count: competitors100m.length,
                names: getCompetitorNames(competitors100m),
            },
            radius_200m: {
                count: competitors200m.length,
                names: getCompetitorNames(competitors200m),
            },
        };

        // --- AI INTERPRETATION ---
        const insights = [];

        // Analyze business activity
        if (within200m.length >= 10) {
            insights.push("✓ High commercial activity area with established businesses");
        } else if (within200m.length >= 5) {
            insights.push("✓ Moderate business presence indicates growing area");
        } else if (within200m.length > 0) {
            insights.push("⚠ Low business density - emerging or underserved location");
        } else {
            insights.push("⚠ Very isolated area - limited foot traffic expected");
        }

        // Analyze competition
        const totalCompetitors = competitors200m.length;
        if (totalCompetitors === 0) {
            insights.push("✓ No direct competitors - first-mover advantage");
        } else if (totalCompetitors <= 2) {
            insights.push("✓ Low competitive pressure - room for market entry");
        } else if (totalCompetitors <= 5) {
            insights.push("⚠ Moderate competition - differentiation needed");
        } else {
            insights.push("⚠ High competitive pressure - saturated market for this category");
        }

        // Zone analysis
        if (zoneType === "Commercial") {
            insights.push("✓ Commercial zone - favorable for business operations");
        } else if (zoneType === "Residential") {
            insights.push("⚠ Residential zone - check local regulations for business permits");
        } else {
            insights.push("• Mixed-use zone - verify zoning requirements");
        }

        // Category-specific insights
        const categoryLower = (category || "").toLowerCase();
        if (categoryLower.includes("food") || categoryLower.includes("restaurant")) {
            if (within100m.length >= 5) {
                insights.push("✓ High foot traffic area - good for food businesses");
            }
        } else if (categoryLower.includes("retail")) {
            if (zoneType === "Commercial") {
                insights.push("✓ Retail-friendly commercial area");
            }
        } else if (categoryLower.includes("service")) {
            insights.push("✓ Service businesses benefit from residential proximity");
        }

        // Limit to 4 insights
        const finalInsights = insights.slice(0, 4);

        // --- SUMMARY STATEMENT ---
        let summary = "";
        const exposureLevel =
            within200m.length >= 10
                ? "high"
                : within200m.length >= 5
                    ? "moderate"
                    : "low";
        const competitionLevel =
            totalCompetitors >= 5
                ? "high"
                : totalCompetitors >= 2
                    ? "moderate"
                    : "low";

        summary = `This ${zoneType.toLowerCase()} zone location has ${exposureLevel} business exposure with ${within200m.length} establishments within 200m. `;

        if (competitionLevel === "low") {
            summary += `Competition is minimal (${totalCompetitors} direct competitors), presenting a favorable opportunity for a ${category} business. `;
        } else if (competitionLevel === "moderate") {
            summary += `Moderate competition exists (${totalCompetitors} direct competitors), requiring differentiation strategy. `;
        } else {
            summary += `High competition (${totalCompetitors} competitors) suggests a saturated market for ${category}. `;
        }

        summary += `Best suited for ${exposureLevel === "high"
                ? "high-traffic retail or food service"
                : exposureLevel === "moderate"
                    ? "service-oriented or specialty businesses"
                    : "destination-based or online-hybrid businesses"
            }.`;

        // --- FINAL RESPONSE ---
        const analysis = {
            success: true,
            location: { latitude, longitude },
            category,
            zoneType,
            businessPresence,
            competitorPressure,
            aiInterpretation: finalInsights,
            summary,
            metadata: {
                totalBusinesses: within200m.length,
                totalCompetitors: totalCompetitors,
                exposureLevel,
                competitionLevel,
                analyzedAt: new Date().toISOString(),
            },
        };

        return res.status(200).json(analysis);
    } catch (error) {
        console.error("Location Analysis Error:", error);
        return res.status(500).json({
            error: "Analysis failed",
            message: error.message,
        });
    }
}
