import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      businessIdea, coordinates, zoneType, generalCategory,
      businessDensity, competitorDensity, nearbyBusinesses, nearbyCompetitors,
      clusterAnalytics, confidence, opportunity
    } = req.body;

    if (!coordinates || !zoneType) {
      return res.status(400).json({ error: "Missing location data" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "AI not configured" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Extract density metrics
    const b50 = businessDensity?.density_50m ?? 0;
    const b100 = businessDensity?.density_100m ?? 0;
    const b200 = businessDensity?.density_200m ?? 0;
    const c50 = competitorDensity?.competitor_50m ?? 0;
    const c100 = competitorDensity?.competitor_100m ?? 0;
    const c200 = competitorDensity?.competitor_200m ?? 0;

    // Format nearby businesses
    const topBiz = (nearbyBusinesses || []).slice(0, 10).map((b, i) =>
      `${i + 1}. ${b.business?.business_name || b.name} (${b.business?.general_category || b.category})`
    ).join("\n");

    // Format competitors
    const topCompetitors = (nearbyCompetitors || []).slice(0, 5).map((c, i) =>
      `${i + 1}. ${c.business?.business_name || c.name}`
    ).join("\n");

    // Cluster analytics
    const clusterProfile = clusterAnalytics?.clusterProfile || "Unknown";
    const dominantCategory = clusterAnalytics?.dominantCategory || generalCategory || "Mixed";
    const totalBusinesses = clusterAnalytics?.totalBusinesses ?? nearbyBusinesses?.length ?? 0;

    // Build comprehensive system prompt
    const systemPrompt = `You are an AI Business Recommendation Engine.

Use ONLY the provided clustering data:
- User's business idea + category
- Clusters (ID, centroid, business count)
- Nearby businesses and competitors

Your tasks:
1. Recommend the best cluster for the user's business based on business counts and opportunity gaps.
2. Generate the Top 3 additional business ideas that fit well in the same cluster.
3. For each recommended business, provide:
   - Score (0–100)
   - Fit Percentage
   - Opportunity Level (High/Medium/Low)
   - Short reason (use density + gap patterns only)

Do NOT use external data like population or foot traffic.
If data is incomplete, still provide recommendations based on available data.
Output must be formatted for UI display.`;

    const userPrompt = `Business Idea: "${businessIdea || "General " + (generalCategory || "Business")}"
Detected Category: ${generalCategory || "Not specified"}

CLUSTERING RESULTS:
Location: ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}
Zone Type: ${zoneType}
Cluster Profile: ${clusterProfile}
Dominant Category: ${dominantCategory}

BUSINESS DENSITY:
- Within 50m: ${b50} businesses
- Within 100m: ${b100} businesses
- Within 200m: ${b200} businesses

COMPETITION:
- Within 50m: ${c50} competitors
- Within 100m: ${c100} competitors
- Within 200m: ${c200} competitors

NEARBY BUSINESSES:
${topBiz || "No nearby businesses found"}

DIRECT COMPETITORS:
${topCompetitors || "No direct competitors found"}

OPPORTUNITY LEVEL: ${opportunity || "Moderate"}

Return ONLY valid JSON in this exact format:
{
  "best_cluster": {
    "cluster_id": "Cluster X",
    "reason": "One sentence why this cluster is best"
  },
  "top_3_businesses": [
    {
      "name": "Business Name",
      "score": 92,
      "fit_percentage": 88,
      "opportunity_level": "High",
      "reason": "Short reason based on density and gaps"
    },
    {
      "name": "Business Name 2",
      "score": 85,
      "fit_percentage": 82,
      "opportunity_level": "Medium-High",
      "reason": "Short reason"
    },
    {
      "name": "Business Name 3",
      "score": 79,
      "fit_percentage": 77,
      "opportunity_level": "Medium",
      "reason": "Short reason"
    }
  ],
  "cluster_summary": [
    { "cluster_id": 1, "business_count": ${b50 + b100}, "competition": "High/Medium/Low" },
    { "cluster_id": 2, "business_count": ${b100}, "competition": "Medium" },
    { "cluster_id": 3, "business_count": ${b200 - b100}, "competition": "Low" }
  ],
  "final_suggestion": "One clear sentence recommendation",
  "confidence": ${Math.min(95, Math.max(60, 85 - c50 * 5 + b100 * 2))}
}`;


    const result = await model.generateContent([
      { role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }
    ]);
    const text = result.response.text();

    let data;
    try {
      let clean = text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
      data = JSON.parse(clean);
    } catch {
      // Fallback response if JSON parsing fails
      const competitionLevel = c50 >= 3 ? "High" : c100 >= 5 ? "Medium" : "Low";
      const score1 = Math.max(60, 90 - c50 * 5);
      const score2 = Math.max(55, score1 - 7);
      const score3 = Math.max(50, score2 - 6);

      data = {
        best_cluster: {
          cluster_id: "Cluster 1",
          reason: c50 === 0
            ? "No direct competitors nearby - excellent entry opportunity."
            : `${zoneType} zone with ${competitionLevel.toLowerCase()} competition.`
        },
        top_3_businesses: [
          {
            name: businessIdea || `${generalCategory || "General"} Business`,
            score: score1,
            fit_percentage: score1 - 4,
            opportunity_level: score1 >= 80 ? "High" : score1 >= 65 ? "Medium-High" : "Medium",
            reason: c50 === 0 ? "No direct competitors within 50m." : `${competitionLevel} competition, differentiation needed.`
          },
          {
            name: `${generalCategory || "Retail"} Services`,
            score: score2,
            fit_percentage: score2 - 3,
            opportunity_level: score2 >= 80 ? "High" : score2 >= 65 ? "Medium-High" : "Medium",
            reason: `Complements existing ${b100} businesses nearby.`
          },
          {
            name: "Convenience Store",
            score: score3,
            fit_percentage: score3 - 2,
            opportunity_level: score3 >= 80 ? "High" : score3 >= 65 ? "Medium" : "Low-Medium",
            reason: `Essential services always in demand in ${zoneType} zones.`
          }
        ],
        cluster_summary: [
          { cluster_id: 1, business_count: b50, competition: c50 >= 3 ? "High" : c50 >= 1 ? "Medium" : "Low" },
          { cluster_id: 2, business_count: b100 - b50, competition: "Medium" },
          { cluster_id: 3, business_count: b200 - b100, competition: "Low" }
        ],
        final_suggestion: c50 === 0
          ? "Excellent opportunity - proceed with your business plan."
          : "Focus on differentiation to stand out from competitors.",
        confidence: Math.min(95, Math.max(60, 85 - c50 * 5 + b100 * 2))
      };
    }

    return res.status(200).json({ success: true, recommendations: data });

  } catch (err) {
    console.error("AI Error:", err.message);
    return res.status(500).json({ error: "AI error", message: err.message });
  }
}
