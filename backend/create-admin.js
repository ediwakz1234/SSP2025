import fetch from "node-fetch";
import * as dotenv from "dotenv";

dotenv.config();

const SECRET = process.env.SUPABASE_SERVICE_KEY;
const PROJECT_URL = process.env.SUPABASE_URL;


console.log("Loaded PROJECT_URL:", PROJECT_URL);
console.log("Loaded SECRET:", SECRET ? "OK" : "MISSING");

async function createAdmin() {
  const email = "sspdev2k25@gmail.com";
  const password = "admin";
  const role = "admin";

  const res = await fetch(`${PROJECT_URL}/api/admin/users`, {
    method: "POST",
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { role },
    }),
  });

  const data = await res.json();
  console.log("Response:", data);
}

createAdmin();
