import { supabase } from "../lib/supabase";
// ===============================
// Business Type (matches your DB)
// ===============================
export type Business = {
  business_id: number;
  business_name: string;
  category: string;
  latitude: number;
  longitude: number;
  street: string;
  zone_type: string;
  created_at?: string;
  updated_at?: string;
};

// ==========================================
// LOCATION DATA (Used by MapPage UI)
// ==========================================
export const LOCATION_INFO = {
  barangay: "Sta. Cruz",
  municipality: "Santa Maria",
  province: "Bulacan",
  population: 11364,
  center_latitude: 14.8373,
  center_longitude:  120.9558,
  postal_code: 3022,
  description: "A mixed residential–commercial area with active business growth.",
};

// ==========================================
// Internal cache so data isn't fetched twice
// ==========================================
let cachedBusinesses: Business[] | null = null;

// ==========================================
// Fetch REAL businesses from Supabase
// ==========================================
export async function fetchBusinesses(): Promise<Business[]> {
  if (cachedBusinesses) return cachedBusinesses;

  const { data, error } = await supabase.from("businesses").select("*");

  if (error) {
    console.error("Failed to load businesses:", error);
    return [];
  }

  cachedBusinesses = data as Business[];
  return cachedBusinesses;
}

// ==========================================
// Fetch REAL categories using RPC
// (Requires you to create get_categories() RPC)
// ==========================================
export async function fetchCategories(): Promise<string[]> {
  const { data, error } = await supabase.rpc("get_categories");

  if (error) {
    console.error("Failed to load categories:", error);
    return [];
  }

  return data.map((c: { category: string }) => c.category);
}

// ==========================================
// Returns list of unique categories locally
// (still here for fallback or non-RPC uses)
// ==========================================
export async function getUniqueCategories(): Promise<string[]> {
  const data = await fetchBusinesses();
  const categories = Array.from(new Set(data.map((b) => b.category)));
  return categories.sort();
}

// ==========================================
// `businesses` export (async wrapper)
// ==========================================
export const businesses = fetchBusinesses();
