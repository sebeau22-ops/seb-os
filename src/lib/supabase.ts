import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client server-only — service role bypasse RLS
export const db = createClient(url, key, {
  auth: { persistSession: false },
});
