import supabase from "../../lib/supabaseClient.js";
import { verifyAdmin } from "./auth.js";

export default async function handler(req, res) {
  const admin = verifyAdmin(req, res);
  if (!admin || admin.error) return;

  const { data, error } = await supabase.from("users").select("*");

  if (error) return res.status(500).json({ error: "Database error" });

  return res.status(200).json({
    success: true,
    admin: admin.email,
    users: data,
  });
}
