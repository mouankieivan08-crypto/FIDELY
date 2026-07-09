import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Client-side Supabase client, used only for auth (Google sign-in, session).
// Uses the publishable key, which is safe to expose in the browser.
export const supabase = createClient(supabaseUrl, supabasePublishableKey);
