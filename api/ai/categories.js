import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    try {
        const { businessIdea } = req.body;
        if (!businessIdea) return res.status(400).json({ error: "Missing businessIdea" });
        if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "AI not configured" });

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `Classify "${businessIdea}" into ONE category: Retail, Entertainment/Leisure, Merchandise/Trading, Food and Beverages, Restaurant, Services, or Misc.
Reply JSON only: {"category":"<category>","explanation":"<10 words max>"}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");

        try {
            const data = JSON.parse(text);
            return res.status(200).json({ category: data.category, explanation: data.explanation });
        } catch {
            // Fallback: extract category from text
            const cats = ["Retail", "Entertainment", "Merchandise", "Food", "Restaurant", "Services"];
            const found = cats.find(c => text.toLowerCase().includes(c.toLowerCase()));
            return res.status(200).json({ category: found || "Services", explanation: "Auto-classified" });
        }

    } catch (err) {
        console.error("AI Category Error:", err.message);
        // Rate limit handling - return fallback
        if (err.message?.includes("429") || err.message?.includes("quota")) {
            return res.status(200).json({
                category: "Services",
                explanation: "Rate limited - using default",
                rate_limited: true
            });
        }
        return res.status(500).json({ error: "AI error", message: err.message });
    }
}
