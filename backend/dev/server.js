import { createServer } from "http";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const server = createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  // MATCH YOUR BACKEND PATH EXACTLY:
  if (req.url === "/api/ai/categories" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", async () => {
      try {
        const { businessIdea } = JSON.parse(body || "{}");

        if (!businessIdea) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "businessIdea is required" }));
        }

        
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
          Classify this business idea into one of:

          • Food & Beverage
          • Retail
          • Services
          • Hardware / Construction
          • Entertainment / Tech
          • Miscellaneous

          Business Idea: "${businessIdea}"

          Return ONLY json:
          { "category": "", "explanation": "" }
        `;

        const aiRes = await model.generateContent(prompt);
        const raw = aiRes.response.text();
        const match = raw.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(match ? match[0] : raw);

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(parsed));

      } catch (err) {
        console.error("Error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "AIError", message: err.message }));
      }
    });
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
  }
});

server.listen(3001, () =>
  console.log("✔ Local dev API running at http://localhost:3001/api/ai/categories")
);
