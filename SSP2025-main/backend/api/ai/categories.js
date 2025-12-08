import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { businessIdea } = req.body;

    if (!businessIdea) {
      return res.status(400).json({ error: "Missing businessIdea" });
    }

    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not configured");
      return res.status(500).json({ error: "AI service not configured" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Use the current stable Gemini model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
Business idea: "${businessIdea}"
Pick ONE category: Retail; Services; Restaurant; Food & Beverages; Merchandise / Trading; Entertainment / Leisure.
Return JSON only:
{"category":"<one from list>","explanation":"why in <=12 words"}
`;

    const aiRes = await model.generateContent(prompt);
    const text = aiRes.response.text();

    // Valid categories that exactly match DB and frontend
    const VALID_CATEGORIES = [
      "Retail",
      "Services",
      "Restaurant",
      "Food & Beverages",
      "Merchandise / Trading",
      "Entertainment / Leisure"
    ];

    // Normalize category to match exactly
    function normalizeCategory(cat) {
      if (!cat) return "Retail";
      const lower = cat.toLowerCase().trim();

      // Exact matches (case-insensitive)
      for (const valid of VALID_CATEGORIES) {
        if (lower === valid.toLowerCase()) return valid;
      }

      // Partial matches
      if (lower.includes("food") || lower.includes("beverage") || lower.includes("cafe") || lower.includes("coffee") || lower.includes("milk tea")) {
        return "Food & Beverages";
      }
      if (lower.includes("restaurant") || lower.includes("dining") || lower.includes("eatery")) {
        return "Restaurant";
      }
      if (lower.includes("service")) return "Services";
      if (lower.includes("retail") || lower.includes("store") || lower.includes("shop")) return "Retail";
      if (lower.includes("merchandise") || lower.includes("trading")) return "Merchandise / Trading";
      if (lower.includes("entertainment") || lower.includes("leisure") || lower.includes("gaming") || lower.includes("arcade")) {
        return "Entertainment / Leisure";
      }
      if (lower.includes("pet")) return "Services"; // Pet stores map to Services

      return "Retail"; // Default fallback
    }

    // Parse the JSON response from Gemini
    try {
      // Clean the response (remove markdown code blocks if present)
      let cleanedText = text.trim();
      if (cleanedText.startsWith("```json")) {
        cleanedText = cleanedText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      } else if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```\n?/, "").replace(/\n?```$/, "");
      }

      const parsed = JSON.parse(cleanedText);
      const normalizedCategory = normalizeCategory(parsed.category);

      return res.status(200).json({
        category: normalizedCategory,
        explanation: parsed.explanation || "AI categorization based on business characteristics."
      });
    } catch (parseErr) {
      // Fallback: if JSON parsing fails, use the raw text as category
      console.warn("Could not parse AI response as JSON, using raw text:", text);
      return res.status(200).json({
        category: normalizeCategory(text.trim().split("\n")[0]),
        explanation: "Classified based on business description."
      });
    }

  } catch (err) {
    console.error("Gemini API Error:", err);
    const msg = err?.message || "";
    if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
      return res.status(429).json({
        error: "quota_exceeded",
        message: "Gemini quota exceeded. Please wait a moment or use a key with higher limits."
      });
    }
    return res.status(500).json({ error: "AI error", message: "Gemini service unavailable" });
  }
}
