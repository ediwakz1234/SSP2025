import { GoogleGenerativeAI } from "@google/generative-ai";

// Prohibited business keywords (checked before AI call for efficiency)
const PROHIBITED_KEYWORDS = [
    "gambling", "casino", "betting", "lottery",
    "prostitution", "escort", "adult entertainment", "brothel",
    "drugs", "drug den", "narcotics", "marijuana dispensary", "shabu",
    "firearms", "gun manufacturing", "weapons", "explosives", "ammunition",
    "money laundering", "laundering",
    "fraud", "scam", "ponzi", "pyramid scheme",
    "human trafficking", "trafficking",
    "terrorism", "terrorist",
    "counterfeit", "fake money", "bootleg",
    "illegal", "black market", "underground",
    "cockfighting", "sabong", "jueteng"
];

// Check if input looks like nonsense
function isNonsenseInput(text) {
    const cleaned = text.trim().toLowerCase();

    // Too short
    if (cleaned.length < 3) return true;

    // Only special characters
    if (/^[^a-zA-Z0-9]+$/.test(cleaned)) return true;

    // Too many special characters (more than 30%)
    const specialCount = (cleaned.match(/[^a-zA-Z0-9\s]/g) || []).length;
    if (specialCount / cleaned.length > 0.3) return true;

    // Keyboard smashing patterns (repeated consonants without vowels)
    if (/^[bcdfghjklmnpqrstvwxyz]{5,}$/i.test(cleaned.replace(/\s/g, ''))) return true;

    // Random letter sequences like "asdasd", "qwerty", "zxcvbn"
    const randomPatterns = [
        /asdf/i, /qwer/i, /zxcv/i, /jkl/i, /fgh/i,
        /asd/i, /sdf/i, /dfg/i,
        /(.)\1{3,}/i // Same letter repeated 4+ times
    ];
    for (const pattern of randomPatterns) {
        if (pattern.test(cleaned.replace(/\s/g, ''))) return true;
    }

    // Must contain at least one vowel to be a real word
    if (!/[aeiou]/i.test(cleaned)) return true;

    // Check for words with too many consecutive consonants (5+)
    if (/[bcdfghjklmnpqrstvwxyz]{6,}/i.test(cleaned)) return true;

    return false;
}

// Check for prohibited keywords
function containsProhibitedKeywords(text) {
    const cleaned = text.toLowerCase();
    for (const keyword of PROHIBITED_KEYWORDS) {
        if (cleaned.includes(keyword)) {
            return true;
        }
    }
    return false;
}

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

        if (!businessIdea || !businessIdea.trim()) {
            return res.status(200).json({
                valid: false,
                errorType: "empty",
                message: "Please enter a business idea."
            });
        }

        const trimmedIdea = businessIdea.trim();

        // Step 1: Check for nonsense input (fast, no API call needed)
        if (isNonsenseInput(trimmedIdea)) {
            return res.status(200).json({
                valid: false,
                errorType: "nonsense",
                message: "Please enter a valid business idea. Random or unrecognized words are not allowed."
            });
        }

        // Step 2: Check for prohibited keywords (fast, no API call needed)
        if (containsProhibitedKeywords(trimmedIdea)) {
            return res.status(200).json({
                valid: false,
                errorType: "prohibited",
                message: "This business type is not allowed. Please enter a legal and valid business idea."
            });
        }

        // Step 3: Use AI to validate further
        if (!process.env.GEMINI_API_KEY) {
            // Fallback: if no API key, allow if it passed basic checks
            return res.status(200).json({
                valid: true,
                message: "Business idea accepted."
            });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
You are a business validation expert for the Philippines. Analyze this business idea and determine if it's valid.

Business Idea: "${trimmedIdea}"

Check for:
1. Is this a legitimate, legal business type in the Philippines?
2. Is this text coherent and meaningful (not random gibberish)?
3. Is this a recognizable business category?
4. Is this prohibited or illegal? (gambling, drugs, prostitution, scams, etc.)

IMPORTANT: Be lenient with valid businesses. Accept common businesses like:
- Sari-sari store, tindahan
- Milk tea shop, cafe, coffee shop
- Laundry shop, laundromat
- Pharmacy, drugstore
- Water refilling station
- Hardware store, construction supplies
- Bakery, bakeshop
- Computer shop, internet cafe
- Salon, barber shop
- Carinderia, eatery, restaurant
- Grocery store, supermarket
- Rice dealer, rice store
- Clothing store, RTW, boutique
- Cellphone/gadget shop
- Auto parts, vulcanizing
- Pet shop
- And any other legitimate small-medium business

Respond in this exact JSON format:
{
  "valid": true or false,
  "errorType": "none" or "prohibited" or "nonsense" or "unrecognized",
  "message": "Brief explanation",
  "reason": "Why valid or invalid"
}

Return ONLY valid JSON, no markdown.
`;

        const aiRes = await model.generateContent(prompt);
        const text = aiRes.response.text();

        try {
            let cleanedText = text.trim();
            if (cleanedText.startsWith("```json")) {
                cleanedText = cleanedText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
            } else if (cleanedText.startsWith("```")) {
                cleanedText = cleanedText.replace(/^```\n?/, "").replace(/\n?```$/, "");
            }

            const parsed = JSON.parse(cleanedText);

            return res.status(200).json({
                valid: parsed.valid === true,
                errorType: parsed.valid ? "none" : (parsed.errorType || "unrecognized"),
                message: parsed.valid
                    ? "Business idea is valid."
                    : (parsed.message || "Business idea not recognized. Please enter a valid business type."),
                reason: parsed.reason
            });

        } catch (parseErr) {
            // If parsing fails, be lenient and allow
            console.warn("Could not parse AI validation response:", text);
            return res.status(200).json({
                valid: true,
                message: "Business idea accepted."
            });
        }

    } catch (err) {
        console.error("Business Validation Error:", err);
        // On error, be lenient - allow the business if basic checks passed
        return res.status(200).json({
            valid: true,
            message: "Business idea accepted."
        });
    }
}
