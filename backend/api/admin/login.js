import supabase from "../../lib/supabaseClient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import * as dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email and password required." });

  // Fetch admin from public users table
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !user)
    return res.status(401).json({ error: "Invalid credentials." });

  // Check admin role
  if (user.role !== "admin" && !user.is_superuser)
    return res.status(403).json({ error: "Access denied." });

  // Validate password (bcrypt)
  const validPassword = await bcrypt.compare(password, user.hashed_password);
  if (!validPassword)
    return res.status(401).json({ error: "Incorrect password." });

  // Generate token
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: "admin",
    },
    JWT_SECRET,
    { expiresIn: "2h" }
  );

  return res.status(200).json({
    success: true,
    message: "Admin logged in",
    token,
    admin: {
      id: user.id,
      email: user.email,
      username: user.username,
    },
  });
}
