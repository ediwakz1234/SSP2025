import { createClient } from "@supabase/supabase-js";

// environment variables from your .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// create the client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
