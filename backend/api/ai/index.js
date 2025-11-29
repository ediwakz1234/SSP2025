import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = express.Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// -------------------------------
// AI Category Detection Endpoint
// -------------------------------
router.post("/ai-detect-category", async (req, res) => {
  const { text } = req.body;

  if (!text || text.trim() === "") {
    return res.status(400).json({
      category: "Unknown",
      explanation: "No business idea provided.",
    });
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", // fast + cheap
    });

    const prompt = `
      You are a business classification expert.
      Classify the following business idea into **one best matching business category**.

      Allowed Categories:
      - Food
      - Retail
      - Services
      - Water
      - Hardware
      - Healthcare
      - Education
      - Others

      Respond ONLY in JSON format:
      {
        "category": "...",
        "explanation": "Short explanation why this category fits"
      }

      Business idea: "${text}"
    `;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    // clean JSON response
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleaned);

    return res.json(data);

  } catch (err) {
    console.error("Gemini classification error:", err);
    return res.status(500).json({
      category: "Others",
      explanation: "AI service error. Defaulting to Others.",
    });
  }
});

export default router;
