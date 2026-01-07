import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Check for various env variable naming conventions
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ||
                    import.meta.env.VITE_SUPABASE_PROJECT_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ||
                        import.meta.env.VITE_SUPABASE_PUBLIC_KEY || '';

// Only create client if credentials are configured
let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('Supabase credentials not configured. Auth features will be disabled.');
}

export { supabase };

export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey && supabase !== null;
};
