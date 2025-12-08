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

Your responsibilities:
1. Analyze the user’s business idea based purely on meaning and intent.
2. Assign the correct business category ONLY if the business idea clearly fits one of the allowed categories.
3. If the idea is unclear, vague, nonsense, random words, or not a real business → return "no_category".
4. If the idea involves illegal, harmful, or restricted activities → return "prohibited".

────────────────────────
VALID CATEGORIES (USE ONLY THESE):

- Retail
- Restaurant
- Entertainment / Leisure
- Merchandising / Trading
- Service

Do NOT output any category outside this list.
────────────────────────

ILLEGAL / PROHIBITED BUSINESS IDEAS (NEVER CLASSIFY):

- Drugs, narcotics, cannabis (unless legally regulated)
- Cigarettes, vapes, tobacco distribution (if legally restricted)
- Gambling, casinos, betting, illegal lottery operations
- Prostitution, escorting, “spakol,” massage with sexual intent, adult sexual services
- Human trafficking or exploitation
- Selling weapons, firearms, explosives (if illegal)
- Cybercrime, fraud, piracy, scamming
- Any activity that is clearly illegal or harmful

If the input contains ANY prohibited activity, return exactly:
{
  "category": "prohibited",
  "reasoning": "The business idea involves illegal or restricted activities."
}
────────────────────────

OUTPUT FORMAT (STRICT — FOLLOW EXACT STRUCTURE):

{
  "category": "<Retail | Restaurant | Entertainment / Leisure | Merchandising / Trading | Service | no_category | prohibited>",
  "reasoning": "<brief explanation>"
}

────────────────────────
CLASSIFICATION RULES:

- Do NOT guess or approximate a category.
- Do NOT default to "Service" when the idea is unclear.
- If the input is ambiguous, incomplete, inappropriate, slang, or nonsense 
  (examples: "scatter", "spakol", "asdf", "123", random words) → return:

{
  "category": "no_category",
  "reasoning": "The input does not describe a valid business idea."
}

────────────────────────
EXAMPLES:

Input: "Milk tea shop"
Output:
{
  "category": "Restaurant",
  "reasoning": "Milk tea shops serve prepared beverages and food."
}

Input: "Clothing boutique"
Output:
{
  "category": "Retail",
  "reasoning": "A boutique sells clothing directly to customers."
}

Input: "Online casino"
Output:
{
  "category": "prohibited",
  "reasoning": "Gambling activities are restricted or illegal."
}

Input: "Spakol"
Output:
{
  "category": "prohibited",
  "reasoning": "This term refers to sexual services, which are prohibited."
}

Input: "scatter"
Output:
{
  "category": "no_category",
  "reasoning": "This is not a recognizable business idea."
}

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
                    "food & beverage": "Food & Beverages",
                    "food and beverage": "Food & Beverages",
                    "f&b": "Food & Beverages",
                    "beverage": "Food & Beverages",
                    "beverages": "Food & Beverages",
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

            // New prompt doesn't return confidence, so we imply it from validity
            let confidence = 0.9;
            if (normalizedCategory === "no_category" || normalizedCategory === "prohibited") {
                confidence = 0;
            } else if (normalizedCategory === "Services") {
                confidence = 0.7; // Service is a catch-all, so treat as lower confidence
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
