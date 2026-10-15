import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// .env.local に設定があるときだけ有効（未設定時は localStorage モードで動く）
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;
