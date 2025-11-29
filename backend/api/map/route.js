import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --------------------------------------------
// GET /api/map?category=&zone=
// Returns full business list + filter support
// --------------------------------------------
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const zone = searchParams.get("zone");

    let query = supabase
      .from("businesses")
      .select("id, name, category, zone_type, street, latitude, longitude");

    // Apply optional filters
    if (category && category !== "All Categories") {
      query = query.eq("category", category);
    }

    if (zone && zone !== "All Zones") {
      query = query.eq("zone_type", zone);
    }

    const { data: businesses, error } = await query;

    if (error) throw error;

    // Convert to map-ready objects
    const mapped = businesses.map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      zone: b.zone_type,
      street: b.street,
      lat: b.latitude,
      lng: b.longitude,
    }));

    return new Response(JSON.stringify(mapped), { status: 200 });

  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Failed to load business map data",
        details: err.message,
      }),
      { status: 500 }
    );
  }
}
