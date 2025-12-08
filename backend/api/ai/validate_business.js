import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { business_name, businessIdea } = req.body;
    const businessInput = (businessIdea ?? business_name ?? "").toString().trim();

    if (!businessInput) {
        return res.status(400).json({ valid: false, message: "Please enter a valid business type." });
    }

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
        });

        const prompt = `
Business text: "${businessInput}"
If it looks like a real business type/name (e.g., "Milk Tea Shop", "Hardware Store"), return:
{"valid": true, "clean_value": "<short normalized text>"}
If it is nonsense, personal name, random word, or not a business, return:
{"valid": false, "message": "Please enter a valid business type."}
Return JSON only.
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Clean and parse JSON manually
        const cleaned = responseText.replace(/```json|```/g, "").trim();
        const validationResult = JSON.parse(cleaned);

        return res.status(200).json(validationResult);

    } catch (error) {
        console.error("Business validation error:", error);
        const msg = error?.message || "";
        if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
            return res.status(429).json({
                valid: false,
                message: "Gemini quota exceeded. Please wait a moment or use a key with higher limits."
            });
        }
        return res.status(500).json({ valid: false, message: "Validation service unavailable." });
    }
}
