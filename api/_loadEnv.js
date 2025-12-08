import { config } from "dotenv";
import { resolve } from "path";

// Load env vars for local npm/dev runs (Vercel injects these in production)
const root = process.cwd();

// Order matters: later files override earlier ones
[
  resolve(root, ".env"),
  resolve(root, ".env.local"),
  resolve(root, "backend", ".env"),
  resolve(root, "backend", ".env.local"),
].forEach((path) => {
  config({ path, override: true });
});
