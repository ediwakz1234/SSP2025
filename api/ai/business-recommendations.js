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

    // Helper function to convert percentage to user-friendly label
    const getConfidenceLabel = (confidence) => {
      if (confidence <= 25) return "Not Ideal";
      if (confidence <= 50) return "Could Work";
      if (confidence <= 75) return "Good Choice";
      return "Best Choice";
    };

    // Helper function to get color based on confidence label
    const getConfidenceColor = (label) => {
      switch (label) {
        case "Not Ideal": return "#E63946";
        case "Could Work": return "#F4A261";
        case "Good Choice": return "#2A9D8F";
        case "Best Choice": return "#2ECC71";
        default: return "#2A9D8F";
      }
    };

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

Use ONLY the provided clustering and business environment data:
- User's business idea and category
- Cluster information (clusterId, centroid, business count)
- Business density & competitor counts
- Nearby business details
- Opportunity level from analysis

-----------------------------------
ZONE NAMING RULES (STRICT):
-----------------------------------
Assign the best cluster EXACTLY ONE of these:
1. "Commercial Zone"
2. "Residential Zone"
3. "Mixed Zone"

Do NOT generate new zone names.

-----------------------------------
SCORING RULES (STRICT & DYNAMIC):
-----------------------------------
Each recommended business must receive a unique score based on:
- How well the business matches the zone type
- Density of businesses within 50m/100m/200m
- Number of direct competitors nearby
- Complementary services in the area
- Gap in supply vs demand

Scoring Range:
- All scores MUST be between 70 and 100
- No two recommended businesses may have the same score
- No reused scoring patterns (avoid 92/88/85 repetition)

Fit Percentage:
- Must be between 70% and 100%
- Cannot be identical to the score
- Should logically correlate with the score

-----------------------------------
OPPORTUNITY LEVEL LABEL (BUSINESS-FRIENDLY):
-----------------------------------
Assign opportunityLevel based on SCORE:

Score 90-100  = "Excellent Potential"
Score 80-89   = "Strong Potential"
Score 70-79   = "Moderate Potential"
Score below 70 = "Limited Potential"

-----------------------------------
CONFIDENCE LABEL:
-----------------------------------
Convert confidence % to a user-friendly label:

1-25%   = "Not Ideal"
26-50%  = "Could Work"
51-75%  = "Good Choice"
76-100% = "Best Choice"

-----------------------------------
TOP 3 BUSINESS RECOMMENDATIONS:
-----------------------------------
For EACH recommended business include:
- name
- score (unique, 70-100)
- fitPercentage (unique, 70-100)
- opportunityLevel (from scoring rules above)
- shortDescription (1-2 simple sentences)
- fullDetails (simple, friendly explanation)
- preferredLocation (best spot inside cluster)
- startupBudget ("PHP xx,xxx - PHP xx,xxx")
- competitorPresence (simple explanation)
- businessDensityInsight (how crowded or open the area is)

Return ONLY valid JSON.`;

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
  "bestCluster": {
    "clusterId": 1,
    "zoneType": "Commercial Zone",
    "reason": "Simple reason why this cluster is best",
    "confidence": 85,
    "confidenceLabel": "Best Choice"
  },
  "topBusinesses": [
    {
      "name": "Business Name",
      "score": 94,
      "fitPercentage": 91,
      "opportunityLevel": "Excellent Potential",
      "shortDescription": "1-2 simple sentences about this business.",
      "fullDetails": "Clear explanation using simple words.",
      "preferredLocation": "Near the main road or community entrance.",
      "startupBudget": "PHP 80,000 - PHP 150,000",
      "competitorPresence": "Only 1 similar shop nearby.",
      "businessDensityInsight": "Moderately busy area."
    },
    {
      "name": "Business Name 2",
      "score": 87,
      "fitPercentage": 84,
      "opportunityLevel": "Strong Potential",
      "shortDescription": "Short description.",
      "fullDetails": "Full explanation in simple words.",
      "preferredLocation": "Suggested location.",
      "startupBudget": "PHP 50,000 - PHP 100,000",
      "competitorPresence": "Competition info.",
      "businessDensityInsight": "Density insight."
    },
    {
      "name": "Business Name 3",
      "score": 76,
      "fitPercentage": 79,
      "opportunityLevel": "Moderate Potential",
      "shortDescription": "Short description.",
      "fullDetails": "Full explanation in simple words.",
      "preferredLocation": "Suggested location.",
      "startupBudget": "PHP 30,000 - PHP 80,000",
      "competitorPresence": "Competition info.",
      "businessDensityInsight": "Density insight."
    }
  ],
  "clusterSummary": [
    { "clusterId": 1, "zoneType": "Commercial Zone", "businessCount": ${b50 + b100}, "competitionLevel": "High" },
    { "clusterId": 2, "zoneType": "Mixed Zone", "businessCount": ${b100}, "competitionLevel": "Medium" },
    { "clusterId": 3, "zoneType": "Residential Zone", "businessCount": ${Math.max(0, b200 - b100)}, "competitionLevel": "Low" }
  ],
  "finalSuggestion": "This cluster looks like a good place for your business because people in the area need these kinds of services."
}`;


    const result = await model.generateContent(systemPrompt + "\n\n" + userPrompt);
    const text = result.response.text();

    let data;
    try {
      let clean = text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
      data = JSON.parse(clean);

      // Ensure confidenceLabel and color are always set
      if (data.bestCluster && data.bestCluster.confidence) {
        data.bestCluster.confidenceLabel = getConfidenceLabel(data.bestCluster.confidence);
        data.bestCluster.confidenceColor = getConfidenceColor(data.bestCluster.confidenceLabel);
      }
    } catch {
      // Fallback response if JSON parsing fails
      const competitionLevel = c50 >= 3 ? "High" : c100 >= 5 ? "Medium" : "Low";
      // Zone type based on business count
      const zoneTypeName = b50 + b100 >= 10 ? "Commercial Zone" : b50 + b100 >= 3 ? "Mixed Zone" : "Residential Zone";
      const score1 = Math.max(60, 90 - c50 * 5);
      const score2 = Math.max(55, score1 - 7);
      const score3 = Math.max(50, score2 - 6);
      const confValue = Math.min(95, Math.max(60, 85 - c50 * 5 + b100 * 2));
      const confLabel = getConfidenceLabel(confValue);

      // Helper to get opportunity level from score
      const getOpportunityLevel = (score) => {
        if (score >= 90) return "Excellent Potential";
        if (score >= 80) return "Strong Potential";
        if (score >= 70) return "Moderate Potential";
        return "Limited Potential";
      };

      data = {
        bestCluster: {
          clusterId: 1,
          zoneType: zoneTypeName,
          reason: c50 === 0
            ? `This ${zoneTypeName} has no direct competitors nearby, making it a great place to start.`
            : `This ${zoneTypeName} has ${competitionLevel.toLowerCase()} competition with good potential.`,
          confidence: confValue,
          confidenceLabel: confLabel,
          confidenceColor: getConfidenceColor(confLabel)
        },
        topBusinesses: [
          {
            name: businessIdea || `${generalCategory || "General"} Business`,
            score: Math.min(100, Math.max(70, score1 + 10)),
            fitPercentage: Math.min(100, Math.max(70, score1 + 6)),
            opportunityLevel: getOpportunityLevel(Math.max(70, score1 + 10)),
            shortDescription: c50 === 0
              ? "No similar shops nearby. Good chance to be the first."
              : "Some competition exists, but you can stand out with good service.",
            fullDetails: c50 === 0
              ? "This business fits well here because there are no direct competitors within 50 meters. People in this area may need this service but currently have to go elsewhere. Being the first gives you an advantage."
              : `There are ${c50} similar businesses nearby. To succeed, focus on what makes your business different - better quality, price, or service.`,
            preferredLocation: `Near the main road or central area of this ${zoneTypeName} for maximum visibility.`,
            startupBudget: "PHP 80,000 - PHP 150,000",
            competitorPresence: c50 === 0
              ? "No direct competitors found within 50 meters. Excellent opportunity."
              : `${c50} similar businesses within 50 meters. Moderate competition.`,
            businessDensityInsight: b100 >= 10
              ? "Busy area with many businesses. High foot traffic expected."
              : b100 >= 5
                ? "Moderately active area with steady customer flow."
                : "Quiet area with room for growth. Building customer base may take time."
          },
          {
            name: `${generalCategory || "Retail"} Services`,
            score: Math.min(100, Math.max(70, score2 + 8)),
            fitPercentage: Math.min(100, Math.max(70, score2 + 5)),
            opportunityLevel: getOpportunityLevel(Math.max(70, score2 + 8)),
            shortDescription: `Works well with the ${b100} businesses already here.`,
            fullDetails: `This area already has ${b100} businesses within 100 meters. Adding a service business can complement them and benefit from the foot traffic they bring.`,
            preferredLocation: "Close to existing service businesses for customer convenience.",
            startupBudget: "PHP 50,000 - PHP 120,000",
            competitorPresence: `Complementary to ${b100} nearby businesses. Low direct competition.`,
            businessDensityInsight: `${b100} businesses nearby provide a steady stream of potential customers.`
          },
          {
            name: "Convenience Store",
            score: Math.min(100, Math.max(70, score3 + 15)),
            fitPercentage: Math.min(100, Math.max(70, score3 + 12)),
            opportunityLevel: getOpportunityLevel(Math.max(70, score3 + 15)),
            shortDescription: "Basic needs store that most areas can benefit from.",
            fullDetails: `A convenience store provides daily essentials that people need. In this ${zoneTypeName}, there is usually steady demand for quick purchases.`,
            preferredLocation: "Near residential areas or along main walkways for easy access.",
            startupBudget: "PHP 100,000 - PHP 250,000",
            competitorPresence: "Essential services are always needed. Some competition acceptable.",
            businessDensityInsight: `${zoneTypeName} with ${b200} businesses within 200m. Consistent demand expected.`
          }
        ],
        clusterSummary: [
          { clusterId: 1, zoneType: zoneTypeName, businessCount: b50, competitionLevel: c50 >= 3 ? "High" : c50 >= 1 ? "Medium" : "Low" },
          { clusterId: 2, zoneType: "Mixed Zone", businessCount: Math.max(0, b100 - b50), competitionLevel: "Medium" },
          { clusterId: 3, zoneType: "Residential Zone", businessCount: Math.max(0, b200 - b100), competitionLevel: "Low" }
        ],
        finalSuggestion: c50 === 0
          ? `This ${zoneTypeName} looks like a good place for your business because there are not many similar shops yet. You could be one of the first here.`
          : `This ${zoneTypeName} has some competition, but there is still room for a new business if you offer something unique or better service.`
      };
    }

    return res.status(200).json({ success: true, recommendations: data });

  } catch (err) {
    console.error("AI Error:", err.message);
    return res.status(500).json({ error: "AI error", message: err.message });
  }
}
