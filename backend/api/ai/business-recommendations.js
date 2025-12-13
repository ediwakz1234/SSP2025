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
    const systemPrompt = `You are an AI Business Opportunity and Recommendation Engine for a Strategic Store Placement System.

Your responsibility is to generate two balanced perspectives:
1. Overall Market Overview (category-neutral)
2. User Business Idea Fit (idea-specific but not category-locked)

Both views must be generated every time.

🔁 DUAL-VIEW OUTPUT RULE (NON-NEGOTIABLE)

You MUST generate TWO SEPARATE SECTIONS:

1️⃣ Overall Market Overview
- Represents the general business potential of the area
- Uses ALL businesses across ALL categories
- Must NOT focus on the user's selected business idea

2️⃣ Your Business Idea Fit
- Evaluates how well the user's specific business idea fits
- Uses the idea as context only
- Must NOT restrict recommendations to the same category
- May suggest better alternatives from other categories

🔑 CATEGORY HANDLING RULE (STRICT)

The user's selected business idea and category are PREFERENCE CONTEXT ONLY.
DO NOT FILTER data by the detected category.
Recommendations may come from ANY category.
At least ONE recommendation must be from a DIFFERENT category than the user's detected category.

Allowed categories:
- Retail
- Services
- Food / Beverages
- Merchandise / Trading
- Entertainment / Leisure

📊 DATA USAGE RULES (STRICT)

Use ONLY the provided data:
- Cluster information
- Business density and competitor counts
- Nearby business list
- Direct competitors
- Zone type
- Opportunity level

❌ Do NOT assume foot traffic
❌ Do NOT assume population
❌ Do NOT invent demand, locations, or competitors

🏙️ ZONE NAMING RULES (STRICT)

Assign ONLY ONE of the following:
- "Commercial Zone"
- "Residential Zone"
- "Mixed Zone"

❌ Do NOT generate new zone names

🧮 SCORING RULES (STRICT)

Score Rules:
- Range: 70–100 ONLY
- Each business must have a UNIQUE score
- No repeated score patterns

Fit Percentage Rules:
- Range: 70–100
- Must be different from score
- Must logically correlate with score

Scoring must consider:
- Zone compatibility
- Business density (50m / 100m / 200m)
- Direct competitor count
- Complementary businesses nearby
- Market saturation balance

🏷️ OPPORTUNITY LEVEL LABELS

Automatically assign from score:
- 90–100 → "Excellent Potential"
- 80–89 → "Strong Potential"
- 70–79 → "Moderate Potential"

🎯 CLUSTER CONFIDENCE LABEL

Convert confidence % into:
- 1–25 → "Not Ideal"
- 26–50 → "Could Work"
- 51–75 → "Good Choice"
- 76–100 → "Best Choice"

⚠️ RISK LEVEL RULE (MANDATORY)

Each recommended business MUST include:
- "Low Risk"
- "Medium Risk"
- "High Risk"

Risk must logically match:
- Competition density
- Market saturation
- Operational complexity
- Capital sensitivity

❌ Do NOT invent new risk labels

🧩 MARKET SATURATION INTERPRETATION

- 0–30% → "Good Opportunity"
- 31–60% → "Needs Strategic Planning"
- 61–100% → "Highly Saturated"

Explain saturation using competition and density only.

-----------------------------------
JSON OUTPUT FORMAT (REQUIRED):
-----------------------------------
Return ONLY valid JSON:

{
  "marketOverview": {
    "overallScore": number,
    "opportunityLevel": "Excellent Potential" | "Strong Potential" | "Moderate Potential",
    "competitionLevel": "Low" | "Medium" | "High",
    "marketSaturationPercent": number,
    "marketSaturationStatus": "Good Opportunity" | "Needs Strategic Planning" | "Highly Saturated",
    "areaReadiness": "Low" | "Medium" | "High",
    "zoneType": "Commercial Zone" | "Residential Zone" | "Mixed Zone",
    "summary": "string"
  },
  "ideaFit": {
    "ideaFitScore": number,
    "fitLabel": "Highly Recommended" | "Good Choice" | "Fair Option",
    "competitionForIdea": "Low" | "Medium" | "High",
    "riskLevel": "Low Risk" | "Medium Risk" | "High Risk",
    "setupDifficulty": "Easy" | "Moderate" | "Complex",
    "suggestedAdjustments": "string"
  },
  "bestCluster": {
    "clusterId": number,
    "zoneType": "Commercial Zone" | "Residential Zone" | "Mixed Zone",
    "reason": "string",
    "confidence": number,
    "confidenceLabel": "Not Ideal" | "Could Work" | "Good Choice" | "Best Choice"
  },
  "topBusinesses": [
    {
      "name": "string",
      "category": "string",
      "score": number,
      "fitPercentage": number,
      "opportunityLevel": "Excellent Potential" | "Strong Potential" | "Moderate Potential",
      "riskLevel": "Low Risk" | "Medium Risk" | "High Risk",
      "shortDescription": "string",
      "fullDetails": "string",
      "preferredLocation": "string",
      "startupBudget": "string",
      "competitorPresence": "string",
      "businessDensityInsight": "string"
    }
  ],
  "clusterSummary": [
    {
      "clusterId": number,
      "zoneType": "Commercial Zone" | "Residential Zone" | "Mixed Zone",
      "businessCount": number,
      "competitionLevel": "High" | "Medium" | "Low"
    }
  ],
  "finalSuggestion": "string"
}`;

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
  "marketOverview": {
    "overallScore": 82,
    "opportunityLevel": "Strong Potential",
    "competitionLevel": "Medium",
    "marketSaturationPercent": 35,
    "marketSaturationStatus": "Needs Strategic Planning",
    "areaReadiness": "Medium",
    "zoneType": "Commercial Zone",
    "summary": "This area has moderate business activity with room for new businesses that offer differentiation."
  },
  "ideaFit": {
    "ideaFitScore": 78,
    "fitLabel": "Good Choice",
    "competitionForIdea": "Medium",
    "riskLevel": "Medium Risk",
    "setupDifficulty": "Moderate",
    "suggestedAdjustments": "Consider adding unique menu items or services to stand out from existing competition."
  },
  "bestCluster": {
    "clusterId": 1,
    "zoneType": "Commercial Zone",
    "reason": "Simple reason why this cluster is best",
    "confidence": 85,
    "confidenceLabel": "Best Choice"
  },
  "topBusinesses": [
    {
      "name": "Convenience Store",
      "category": "Retail",
      "score": 94,
      "fitPercentage": 91,
      "opportunityLevel": "Excellent Potential",
      "riskLevel": "Low Risk",
      "shortDescription": "1-2 simple sentences about this business.",
      "fullDetails": "Clear explanation using simple words.",
      "preferredLocation": "Near the main road or community entrance.",
      "startupBudget": "PHP 80,000 - PHP 150,000",
      "competitorPresence": "Only 1 similar shop nearby.",
      "businessDensityInsight": "Moderately busy area."
    },
    {
      "name": "Pharmacy",
      "category": "Services",
      "score": 87,
      "fitPercentage": 84,
      "opportunityLevel": "Strong Potential",
      "riskLevel": "Medium Risk",
      "shortDescription": "Short description.",
      "fullDetails": "Full explanation in simple words.",
      "preferredLocation": "Suggested location.",
      "startupBudget": "PHP 50,000 - PHP 100,000",
      "competitorPresence": "Competition info.",
      "businessDensityInsight": "Density insight."
    },
    {
      "name": "Coffee Shop",
      "category": "Food / Beverages",
      "score": 76,
      "fitPercentage": 79,
      "opportunityLevel": "Moderate Potential",
      "riskLevel": "Medium Risk",
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

      // Helper to get risk level
      const getRiskLevel = (score, competitors) => {
        if (score >= 80 && competitors <= 2) return "Low Risk";
        if (competitors >= 5) return "High Risk";
        return "Medium Risk";
      };

      // Calculate market saturation
      const totalNearby = b50 + b100 + b200;
      const totalCompetitors = c50 + c100 + c200;
      const saturationPercent = totalNearby > 0 ? Math.round((totalCompetitors / totalNearby) * 100) : 0;
      const saturationStatus = saturationPercent <= 30 ? "Good Opportunity" : saturationPercent <= 60 ? "Needs Strategic Planning" : "Highly Saturated";

      // Determine idea fit
      const ideaFitScore = Math.min(100, Math.max(70, 90 - c50 * 8 + b100 * 2));
      const fitLabel = ideaFitScore >= 85 ? "Highly Recommended" : ideaFitScore >= 75 ? "Good Choice" : "Fair Option";
      const setupDifficulty = c50 >= 3 ? "Complex" : c50 >= 1 ? "Moderate" : "Easy";

      data = {
        marketOverview: {
          overallScore: Math.min(100, Math.max(70, 85 - c100 * 3 + b100 * 2)),
          opportunityLevel: getOpportunityLevel(Math.min(100, Math.max(70, 85 - c100 * 3 + b100 * 2))),
          competitionLevel,
          marketSaturationPercent: saturationPercent,
          marketSaturationStatus: saturationStatus,
          areaReadiness: b100 >= 8 ? "High" : b100 >= 4 ? "Medium" : "Low",
          zoneType: zoneTypeName,
          summary: c50 === 0
            ? `This ${zoneTypeName} has low competition and good potential for new businesses.`
            : `This ${zoneTypeName} has ${competitionLevel.toLowerCase()} competition. New businesses can succeed with proper differentiation.`
        },
        ideaFit: {
          ideaFitScore,
          fitLabel,
          competitionForIdea: competitionLevel,
          riskLevel: getRiskLevel(ideaFitScore, c50),
          setupDifficulty,
          suggestedAdjustments: c50 >= 2
            ? "Consider offering unique features or better service to stand out from existing competition."
            : "Good opportunity - focus on quality and building customer relationships."
        },
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
            category: generalCategory || "Retail",
            score: Math.min(100, Math.max(70, score1 + 10)),
            fitPercentage: Math.min(100, Math.max(70, score1 + 6)),
            opportunityLevel: getOpportunityLevel(Math.max(70, score1 + 10)),
            riskLevel: getRiskLevel(Math.max(70, score1 + 10), c50),
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
            name: "Convenience Store",
            category: "Retail",
            score: Math.min(100, Math.max(70, score2 + 8)),
            fitPercentage: Math.min(100, Math.max(70, score2 + 5)),
            opportunityLevel: getOpportunityLevel(Math.max(70, score2 + 8)),
            riskLevel: getRiskLevel(Math.max(70, score2 + 8), c100),
            shortDescription: `Works well with the ${b100} businesses already here.`,
            fullDetails: `This area already has ${b100} businesses within 100 meters. Adding a convenience store can complement them and benefit from the foot traffic they bring.`,
            preferredLocation: "Close to existing service businesses for customer convenience.",
            startupBudget: "PHP 50,000 - PHP 120,000",
            competitorPresence: `Complementary to ${b100} nearby businesses. Low direct competition.`,
            businessDensityInsight: `${b100} businesses nearby provide a steady stream of potential customers.`
          },
          {
            name: "Pharmacy / Drugstore",
            category: "Services",
            score: Math.min(100, Math.max(70, score3 + 15)),
            fitPercentage: Math.min(100, Math.max(70, score3 + 12)),
            opportunityLevel: getOpportunityLevel(Math.max(70, score3 + 15)),
            riskLevel: getRiskLevel(Math.max(70, score3 + 15), c200),
            shortDescription: "Essential healthcare service that every community needs.",
            fullDetails: `A pharmacy provides essential medicines and health products. In this ${zoneTypeName}, there is usually steady demand for healthcare services.`,
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
