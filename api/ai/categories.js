import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

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
      You are a business categorization expert. Analyze the following business idea and:
      1. Classify it into the BEST matching category from this list:
         - Retail
         - Entertainment / Leisure
         - Merchandising / Trading
         - Food and Beverages
         - Restaurant
         - Misc
      
      2. Provide a brief explanation (1-2 sentences) of why this category fits best.

      Business Idea: "${businessIdea}"

      Respond in this exact JSON format:
      {
        "category": "Category Name",
        "explanation": "Brief explanation of the classification"
      }

      Important: Return ONLY valid JSON, no markdown or additional text.
    `;

        const aiRes = await model.generateContent(prompt);
        const text = aiRes.response.text();

        // Valid categories
        const VALID_CATEGORIES = [
            "Retail",
            "Entertainment / Leisure",
            "Merchandising / Trading",
            "Food and Beverages",
            "Restaurant",
            "Misc"
        ];

        // Normalize category to match exactly
        function normalizeCategory(cat) {
            if (!cat) return "Misc";
            const lower = cat.toLowerCase().trim();

            // Exact matches (case-insensitive)
            for (const valid of VALID_CATEGORIES) {
                if (lower === valid.toLowerCase()) return valid;
            }

            // Partial matches
            if (lower.includes("food") || lower.includes("beverage") || lower.includes("cafe") || lower.includes("coffee") || lower.includes("milk tea") || lower.includes("milktea") || lower.includes("bakery")) {
                return "Food and Beverages";
            }
            if (lower.includes("restaurant") || lower.includes("dining") || lower.includes("eatery") || lower.includes("resto") || lower.includes("grill") || lower.includes("diner")) {
                return "Restaurant";
            }
            if (lower.includes("entertainment") || lower.includes("leisure") || lower.includes("gaming") || lower.includes("arcade") || lower.includes("spa") || lower.includes("salon") || lower.includes("computer shop") || lower.includes("internet cafe")) {
                return "Entertainment / Leisure";
            }
            if (lower.includes("merchandise") || lower.includes("trading") || lower.includes("wholesale") || lower.includes("distributor") || lower.includes("supply") || lower.includes("hardware")) {
                return "Merchandising / Trading";
            }
            if (lower.includes("retail") || lower.includes("store") || lower.includes("shop") || lower.includes("boutique")) {
                return "Retail";
            }

            return "Misc"; // Default fallback
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
        return res.status(500).json({ error: "AI error", message: err.message });
    }
}
