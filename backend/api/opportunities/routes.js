import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// -----------------------------
// Utility: Calculate Opportunity Score
// -----------------------------
function calculateOpportunity({ count, total, avgCount }) {
  if (count === 0) return 90; // best possible
  if (count === 1) return 80;
  if (count <= avgCount) return 60;
  return 10; // saturated
}

// -----------------------------
// GET /api/opportunities
// -----------------------------
export async function GET() {
  try {
    // 1️⃣ Fetch all businesses (seed + user CSV)
    const { data: businesses, error } = await supabase
      .from("businesses")
      .select("id, name, category, latitude, longitude, zone_type, street");

    if (error) throw error;

    if (!businesses || businesses.length === 0) {
      return new Response(JSON.stringify([]), { status: 200 });
    }

    // 2️⃣ Aggregate by category
    const categoryMap = {};

    businesses.forEach((b) => {
      if (!categoryMap[b.category]) {
        categoryMap[b.category] = {
          category: b.category,
          count: 0,
          marketShare: 0,
          opportunityScore: 0,
        };
      }
      categoryMap[b.category].count += 1;
    });

    const totalBusinesses = businesses.length;
    const categories = Object.values(categoryMap);

    // 3️⃣ Compute market share + opportunity
    const avgCount =
      categories.reduce((sum, c) => sum + c.count, 0) /
      categories.length;

    categories.forEach((c) => {
      c.marketShare = Number(((c.count / totalBusinesses) * 100).toFixed(2));
      c.opportunityScore = calculateOpportunity({
        count: c.count,
        total: totalBusinesses,
        avgCount,
      });
    });

    // 4️⃣ Group by opportunity level
    const highPotential = categories.filter((c) => c.opportunityScore >= 80);
    const moderate = categories.filter(
      (c) => c.opportunityScore >= 60 && c.opportunityScore < 80
    );
    const saturated = categories.filter((c) => c.opportunityScore <= 20);

    // 5️⃣ Sorted full list
    const rankedCategories = categories.sort(
      (a, b) => b.opportunityScore - a.opportunityScore
    );

    return new Response(
      JSON.stringify({
        summary: {
          totalBusinesses,
          totalCategories: categories.length,
          highPotentialCount: highPotential.length,
          moderateCount: moderate.length,
          saturatedCount: saturated.length,
        },
        highPotential,
        moderate,
        saturated,
        rankedCategories,
      }),
      { status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Failed to calculate business opportunities",
        details: err.message,
      }),
      { status: 500 }
    );
  }
}
