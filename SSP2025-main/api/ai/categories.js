import "../_loadEnv.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {
        const { businessIdea } = req.body;
        if (!businessIdea) return res.status(400).json({ error: "Missing businessIdea" });
        if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "AI not configured" });

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `You are an AI business-category classifier for a Strategic Store Placement System.

Your job:
1. Analyze the user's business idea.
2. Assign the correct business category ONLY if the idea is clear and you are at least 60% confident.
3. If the idea is unclear, random, or not a valid business return "no_category".
4. If the idea involves illegal, harmful, or restricted activities return "prohibited".

VALID CATEGORIES (USE ONLY THESE):
- Retail
- Services
- Restaurant
- Food & Beverages
- Merchandise / Trading
- Entertainment / Leisure

ILLEGAL / PROHIBITED BUSINESS IDEAS (NEVER CLASSIFY):
- Drugs, narcotics, cannabis (unless legally regulated)
- Cigarettes, vapes, tobacco distribution (if restricted)
- Gambling, casino, betting, illegal lottery
- Prostitution, escorting, adult sexual services
- Human trafficking, exploitation
- Selling weapons, firearms, explosives (if illegal)
- Cybercrime, fraud, piracy, scams
- Any explicitly illegal activity

If the input contains any prohibited activity, return:
{ "category": "prohibited", "confidence": 1, "reasoning": "The business idea involves illegal or restricted activities." }

OUTPUT FORMAT (STRICT):
{
  "category": "<Retail | Services | Restaurant | Food & Beverages | Merchandise / Trading | Entertainment / Leisure | no_category | prohibited>",
  "confidence": <number between 0 and 1>,
  "reasoning": "<brief explanation>"
}

RULES:
- If AI confidence < 0.60, return "no_category".
- Do NOT guess or assign a random category.
- Do NOT default to "Service" when uncertain.
- If the idea is too vague (e.g., scatter, ... , random), return:
  { "category": "no_category", "confidence": 0, "reasoning": "The input does not describe a valid business idea." }

EXAMPLES:

Input: "Milk tea shop"
Output: { "category": "Restaurant", "confidence": 0.92, "reasoning": "Milk tea shops serve prepared food and beverages." }

Input: "Clothing boutique"
Output: { "category": "Retail", "confidence": 0.94, "reasoning": "A boutique sells apparel directly to consumers." }

Input: "Online casino"
Output: { "category": "prohibited", "confidence": 1, "reasoning": "Gambling is restricted or illegal." }

Input: "scatter"
Output: { "category": "no_category", "confidence": 0, "reasoning": "Not a business idea." }

Now classify this business idea: "${businessIdea}"

Reply with ONLY the JSON object, no markdown formatting.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");

        try {
            const data = JSON.parse(text);

            const validCategories = [
                "Retail",
                "Services",
                "Restaurant",
                "Food & Beverages",
                "Merchandise / Trading",
                "Entertainment / Leisure",
                "no_category",
                "prohibited",
            ];

            let normalizedCategory = data.category;
            if (normalizedCategory) {
                const categoryMap = {
                    "entertainment": "Entertainment / Leisure",
                    "entertainment/leisure": "Entertainment / Leisure",
                    "leisure": "Entertainment / Leisure",
                    "merchandising": "Merchandise / Trading",
                    "merchandising/trading": "Merchandise / Trading",
                    "trading": "Merchandise / Trading",
                    "merchandise": "Merchandise / Trading",
                    "merchandise / trading": "Merchandise / Trading",
                    "service": "Services",
                    "food and beverages": "Food & Beverages",
                    "food & beverages": "Food & Beverages",
                    "f&b": "Food & Beverages",
                    "pet store": "Services",
                    "pet shop": "Services",
                    "pet": "Services",
                };

                const lowerCategory = normalizedCategory.toLowerCase().trim();
                if (categoryMap[lowerCategory]) {
                    normalizedCategory = categoryMap[lowerCategory];
                }
            }

            if (!validCategories.includes(normalizedCategory)) {
                normalizedCategory = "no_category";
            }

            const confidence = parseFloat(data.confidence) || 0;
            if (confidence < 0.6 && normalizedCategory !== "prohibited" && normalizedCategory !== "no_category") {
                normalizedCategory = "no_category";
            }

            return res.status(200).json({
                category: normalizedCategory,
                confidence: confidence,
                explanation: data.reasoning || data.explanation || "Classified by AI",
            });
        } catch {
            console.error("Failed to parse AI response:", text);
            return res.status(200).json({
                category: "no_category",
                confidence: 0,
                explanation: "Could not parse AI response",
            });
        }
    } catch (err) {
        console.error("AI Category Error:", err.message);
        if (err.message?.includes("429") || err.message?.includes("quota")) {
            return res.status(200).json({
                category: "no_category",
                confidence: 0,
                explanation: "Rate limited - please try again",
                rate_limited: true,
            });
        }
        return res.status(500).json({ error: "AI error", message: err.message });
    }
}
