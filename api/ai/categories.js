import "../_loadEnv.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {
        const { businessIdea, selectedCategory } = req.body;
        if (!businessIdea) return res.status(400).json({ error: "Missing businessIdea" });
        if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "AI not configured" });

        // HARDCODED PROHIBITED CHECK (Pre-AI)
        const PROHIBITED_KEYWORDS = [
            "spakol", "prostitution", "escort", "sexual", "trafficking",
            "drugs", "narcotics", "cannabis", "weed", "marijuana",
            "gambling", "casino", "betting", "lottery",
            "weapon", "firearm", "explosive", "bomb",
            "scam", "fraud", "cybercrime", "piracy", "fake id"
        ];

        const lowerIdea = businessIdea.toLowerCase();
        if (PROHIBITED_KEYWORDS.some(word => lowerIdea.includes(word))) {
            return res.status(200).json({
                primaryCategory: "prohibited",
                secondaryCategories: [],
                allowedCategories: [],
                explanation: "This business idea involves restricted or illegal activities.",
                isValid: false,
                validationError: "Prohibited business type"
            });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `You are an AI business-category classifier for a Strategic Store Placement System in the Philippines.

VALID CATEGORIES (ONLY USE THESE 6):
1. Retail - Stores selling physical goods: pharmacy, hardware, minimart, convenience store, grocery
2. Services - Laundry, barbershop, salon, clinic, spa, car wash, pet grooming, repair shops
3. Restaurant - Full-meal service, dine-in, fast food, eateries, carinderias
4. Food & Beverages - Food stalls, beverage shops, cafés, milk tea, bakeries, snack stands
5. Merchandise / Trading - Buy & sell goods, wholesale, market stalls, ukay-ukay, RTW
6. Entertainment / Leisure - Computer shops, gaming lounges, gyms, fitness centers, recreation

TASK: Analyze this business idea and determine which category/categories it fits.

BUSINESS IDEA: "${businessIdea}"

CLASSIFICATION RULES:
- Some businesses can fit MULTIPLE categories. Return ALL valid categories.
- Primary category = best fit. Secondary = also valid alternatives.
- Be STRICT: only include categories that genuinely apply.

EXAMPLES:
- "Milk Tea Shop" → Primary: Food & Beverages, Also valid: Restaurant
- "Pharmacy" → Primary: Retail, Only Retail applies
- "Computer Shop" → Primary: Entertainment / Leisure, Also valid: Services (if offering repairs)
- "Hardware Store" → Primary: Retail, Only Retail applies
- "Barbershop" → Primary: Services, Only Services applies
- "Ukay-Ukay" → Primary: Merchandise / Trading, Also valid: Retail
- "Gym" → Primary: Entertainment / Leisure, Only Entertainment / Leisure applies
- "Sari-Sari Store" → Primary: Retail, Only Retail applies
- "Fast Food" → Primary: Restaurant, Also valid: Food & Beverages
- "Laundry Shop" → Primary: Services, Only Services applies
- "Pet Shop" → Primary: Retail (if selling pets/supplies), Also valid: Services (if grooming)
- "Internet Cafe" → Primary: Entertainment / Leisure, Only Entertainment / Leisure applies

RESPOND WITH ONLY THIS JSON (no markdown):
{
  "primaryCategory": "<one of the 6 categories OR 'no_category' OR 'prohibited'>",
  "secondaryCategories": ["<other valid categories if any>"],
  "explanation": "<brief 1-sentence explanation>"
}`;

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
                "Entertainment / Leisure"
            ];

            // Normalize category names
            const normalizeCategory = (cat) => {
                if (!cat) return null;
                const categoryMap = {
                    "entertainment": "Entertainment / Leisure",
                    "entertainment/leisure": "Entertainment / Leisure",
                    "entertainment / leisure": "Entertainment / Leisure",
                    "leisure": "Entertainment / Leisure",
                    "merchandising": "Merchandise / Trading",
                    "merchandising/trading": "Merchandise / Trading",
                    "merchandise/trading": "Merchandise / Trading",
                    "merchandise / trading": "Merchandise / Trading",
                    "trading": "Merchandise / Trading",
                    "merchandise": "Merchandise / Trading",
                    "service": "Services",
                    "services": "Services",
                    "food and beverages": "Food & Beverages",
                    "food & beverages": "Food & Beverages",
                    "food & beverage": "Food & Beverages",
                    "food and beverage": "Food & Beverages",
                    "f&b": "Food & Beverages",
                    "beverage": "Food & Beverages",
                    "beverages": "Food & Beverages",
                    "retail": "Retail",
                    "restaurant": "Restaurant",
                };
                const lower = cat.toLowerCase().trim();
                return categoryMap[lower] || (validCategories.includes(cat) ? cat : null);
            };

            let primaryCategory = normalizeCategory(data.primaryCategory);
            let secondaryCategories = (data.secondaryCategories || [])
                .map(normalizeCategory)
                .filter(c => c && c !== primaryCategory);

            // Handle special cases
            if (primaryCategory === "no_category" || primaryCategory === "prohibited") {
                return res.status(200).json({
                    primaryCategory: primaryCategory,
                    secondaryCategories: [],
                    allowedCategories: [],
                    explanation: data.explanation || "Not a valid business idea",
                    isValid: false,
                    validationError: primaryCategory === "prohibited"
                        ? "Prohibited business type"
                        : "Not recognized as a valid business"
                });
            }

            // Ensure primary is valid
            if (!primaryCategory || !validCategories.includes(primaryCategory)) {
                primaryCategory = "no_category";
                return res.status(200).json({
                    primaryCategory: "no_category",
                    secondaryCategories: [],
                    allowedCategories: [],
                    explanation: "Could not determine business category",
                    isValid: false,
                    validationError: "Unrecognized business type"
                });
            }

            // Build allowedCategories (primary + valid secondaries)
            const allowedCategories = [primaryCategory, ...secondaryCategories];

            // Validate selected category if provided
            let isValid = true;
            let validationError = null;

            if (selectedCategory) {
                const normalizedSelected = normalizeCategory(selectedCategory);
                if (!normalizedSelected || !allowedCategories.includes(normalizedSelected)) {
                    isValid = false;
                    validationError = `This business idea belongs to "${primaryCategory}". The selected category "${selectedCategory}" is not allowed.`;
                }
            }

            return res.status(200).json({
                primaryCategory,
                secondaryCategories,
                allowedCategories,
                explanation: data.explanation || `Classified as ${primaryCategory}`,
                isValid,
                validationError,
                // Legacy fields for backwards compatibility
                category: primaryCategory,
                confidence: 0.9,
            });

        } catch (parseError) {
            console.error("Failed to parse AI response:", text);
            return res.status(200).json({
                primaryCategory: "no_category",
                secondaryCategories: [],
                allowedCategories: [],
                explanation: "Could not parse AI response",
                isValid: false,
                validationError: "AI parsing error"
            });
        }
    } catch (err) {
        console.error("AI Category Error:", err.message);
        if (err.message?.includes("429") || err.message?.includes("quota")) {
            return res.status(200).json({
                primaryCategory: "no_category",
                secondaryCategories: [],
                allowedCategories: [],
                explanation: "Rate limited - please try again",
                isValid: false,
                validationError: "Rate limited",
                rate_limited: true,
            });
        }
        return res.status(500).json({ error: "AI error", message: err.message });
    }
}

