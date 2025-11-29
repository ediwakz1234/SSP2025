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

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // NOW THIS WORKS ON VERCEL (latest SDK)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Classify this business idea into:
      - Food & Beverage
      - Retail
      - Services
      - Hardware / Construction
      - Entertainment / Tech
      - Miscellaneous

      Business Idea: "${businessIdea}"

      Return JSON only:
      { "category": "", "explanation": "" }
    `;

    const aiRes = await model.generateContent(prompt);
    const text = aiRes.response.text();
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)[0]);

    return res.status(200).json(json);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI error", message: err.message });
  }
}
