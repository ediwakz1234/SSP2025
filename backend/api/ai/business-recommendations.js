import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * AI Business Recommendation Endpoint
 * Analyzes location data, clustering results, and nearby businesses
 * to generate smart, data-driven business recommendations
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      businessIdea,
      coordinates,
      zoneType,
      generalCategory,
      businessDensity,
      competitorDensity,
      clusterAnalytics,
      nearbyBusinesses,
      nearbyCompetitors,
      confidence,
      opportunity
    } = req.body;

    // Validate required fields
    if (!coordinates || !zoneType) {
      return res.status(400).json({ error: "Missing required location data" });
    }

    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not configured");
      return res.status(500).json({ error: "AI service not configured" });
    }

    console.log("🤖 AI Recommendations: Starting with key:", process.env.GEMINI_API_KEY.slice(0, 10) + "...");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use gemini-1.5-flash (stable) instead of gemini-2.0-flash
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Build the comprehensive prompt based on the specification
    const prompt = `
You are an AI expert specializing in Business Location Analysis and Market Suitability.
Your job is to analyze the provided location, clustering data, and nearby business ecosystem,
then generate smart business recommendations with data-backed reasoning.

Use ONLY the data provided. Do NOT assume population density, foot traffic, or city-wide demographics.

=== INPUT DATA ===

📍 Location:
- Coordinates: ${coordinates.latitude}, ${coordinates.longitude}
- Zone Type: ${zoneType}
- General Category Being Analyzed: ${generalCategory || "Not specified"}
- User Business Idea: ${businessIdea || "Not specified"}

📊 Business Density Metrics:
- Within 50m: ${businessDensity?.density_50m ?? 0} businesses
- Within 100m: ${businessDensity?.density_100m ?? 0} businesses  
- Within 200m: ${businessDensity?.density_200m ?? 0} businesses

🎯 Competitor Density:
- Within 50m: ${competitorDensity?.competitor_50m ?? 0} competitors
- Within 100m: ${competitorDensity?.competitor_100m ?? 0} competitors
- Within 200m: ${competitorDensity?.competitor_200m ?? 0} competitors

📈 Cluster Analytics:
- Cluster Profile: ${clusterAnalytics?.clusterProfile || "Mixed commercial area"}
- Dominant Category: ${clusterAnalytics?.dominantCategory || generalCategory || "Varied"}
- Confidence Score: ${(confidence * 100).toFixed(0)}%
- Opportunity Level: ${opportunity || "Moderate"}

🏪 Nearby Businesses (${nearbyBusinesses?.length || 0} total):
${nearbyBusinesses?.slice(0, 15).map((b, i) =>
      `${i + 1}. ${b.business?.business_name || b.name} - ${b.business?.general_category || b.category} (${(b.distance * 1000).toFixed(0)}m away)`
    ).join('\n') || "No nearby businesses data"}

🏢 Nearby Competitors (${nearbyCompetitors?.length || 0} in same category):
${nearbyCompetitors?.slice(0, 10).map((c, i) =>
      `${i + 1}. ${c.business?.business_name || c.name} (${(c.distance * 1000).toFixed(0)}m away)`
    ).join('\n') || "No direct competitors nearby"}

=== YOUR TASK ===

Analyze this data and provide recommendations in the following JSON format.
Return ONLY valid JSON, no markdown or additional text.

{
  "category_validation": {
    "user_input": "${businessIdea || 'Not specified'}",
    "mapped_category": "One of: Retail, Food & Beverages, Restaurant, Merchandise / Trading, Entertainment / Leisure, Services, Pet Store",
    "reason": "Brief explanation of why this category fits"
  },

  "nearby_business_summary": {
    "total_businesses": ${nearbyBusinesses?.length || 0},
    "total_competitors": ${nearbyCompetitors?.length || 0},
    "top_categories": ["Top 3 categories found nearby based on the data"],
    "area_behavior": "Describe what the area is known for based ONLY on the provided data"
  },

  "competitor_analysis": {
    "competition_level": "Low, Medium, or High based on competitor density data",
    "dominant_competitors": ["List of dominant competitor types"],
    "saturation_notes": "Analysis of market saturation",
    "opportunity_gaps": ["Categories with opportunity gaps based on the data"]
  },

  "location_analysis": {
    "zone_type": "${zoneType}",
    "strengths": ["2-4 strengths based on the data"],
    "weaknesses": ["1-3 weaknesses based on the data"],
    "opportunity_level": "${opportunity || 'Moderate'}",
    "suitability_score": "1-10 score with brief justification"
  },

  "recommendations": [
    {
      "business_name": "Specific business concept name",
      "general_category": "Mapped category",
      "fit_reason": "Why this business fits this location",
      "ecosystem_synergy": "How it benefits from nearby businesses",
      "competition_risk": "Low, Medium, or High",
      "data_points_supporting": ["Specific data points from the input that support this recommendation"]
    }
  ],

  "final_verdict": {
    "suitability": "Highly Suitable, Suitable, Moderately Suitable, or Not Recommended",
    "best_recommendation": "The single best business recommendation",
    "actionable_advice": "1-2 sentences of practical advice"
  }
}

IMPORTANT RULES:
- NO generic statements
- NO assumptions about city traffic, population, or "busy areas"
- ONLY use data given
- Provide 3-5 diverse recommendations
- Be specific and analytical
- Return ONLY valid JSON
`;

    const aiResult = await model.generateContent(prompt);
    const text = aiResult.response.text();

    // Parse the JSON response
    try {
      // Clean the response (remove markdown code blocks if present)
      let cleanedText = text.trim();
      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      } else if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```\n?/, "").replace(/\n?```$/, "");
      }

      const recommendations = JSON.parse(cleanedText);

      return res.status(200).json({
        success: true,
        recommendations,
        generated_at: new Date().toISOString()
      });

    } catch (parseErr) {
      console.error("Failed to parse AI response:", parseErr);
      console.error("Raw response:", text);

      // Return a fallback structured response
      return res.status(200).json({
        success: false,
        error: "Failed to parse AI response",
        raw_response: text,
        fallback: {
          final_verdict: {
            suitability: "Analysis Incomplete",
            best_recommendation: generalCategory || "General Business",
            actionable_advice: "Please try again or consult with a business advisor for detailed analysis."
          }
        }
      });
    }

  } catch (err) {
    console.error("AI Recommendation Error:", err);
    return res.status(500).json({
      error: "AI service error",
      message: err.message
    });
  }
}
