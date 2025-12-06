import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      businessIdea, coordinates, zoneType, generalCategory,
      businessDensity, competitorDensity, nearbyBusinesses, nearbyCompetitors,
      confidence, opportunity
    } = req.body;

    if (!coordinates || !zoneType) {
      return res.status(400).json({ error: "Missing location data" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "AI not configured" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Compact data
    const b50 = businessDensity?.density_50m ?? 0;
    const b100 = businessDensity?.density_100m ?? 0;
    const b200 = businessDensity?.density_200m ?? 0;
    const c50 = competitorDensity?.competitor_50m ?? 0;
    const c100 = competitorDensity?.competitor_100m ?? 0;
    const c200 = competitorDensity?.competitor_200m ?? 0;

    // Top 10 businesses only
    const topBiz = (nearbyBusinesses || []).slice(0, 10).map((b, i) =>
      `${i + 1}. ${b.business?.business_name || b.name} - ${b.business?.general_category || b.category}`
    ).join("; ");

    const prompt = `Analyze location for ${businessIdea || generalCategory || "business"}.
Zone: ${zoneType}, Coords: ${coordinates.latitude},${coordinates.longitude}
Businesses: 50m=${b50}, 100m=${b100}, 200m=${b200}
Competitors: 50m=${c50}, 100m=${c100}, 200m=${c200}
Nearby: ${topBiz || "none"}

Return JSON only:
{"summary":"2 sentences about location","presence":{"50m":${b50},"100m":${b100},"200m":${b200}},"competitors":{"50m":${c50},"100m":${c100},"200m":${c200}},"insights":["insight1","insight2","insight3"],"verdict":"Suitable/Not Suitable","advice":"1 sentence"}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let data;
    try {
      let clean = text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
      data = JSON.parse(clean);
    } catch {
      data = {
        summary: `${zoneType} zone with ${b200} nearby businesses.`,
        presence: { "50m": b50, "100m": b100, "200m": b200 },
        competitors: { "50m": c50, "100m": c100, "200m": c200 },
        insights: [`${opportunity || "Moderate"} opportunity`, `${zoneType} zone`],
        verdict: opportunity === "High" ? "Suitable" : "Moderately Suitable",
        advice: "Review the map for detailed analysis."
      };
    }

    return res.status(200).json({ success: true, recommendations: data });

  } catch (err) {
    console.error("AI Error:", err.message);
    return res.status(500).json({ error: "AI error", message: err.message });
  }
}
