import { createClient } from '@supabase/supabase-js'

// Chaves do projeto Supabase (Dashboard → Project Settings → API).
// A anon key é pública por design — a segurança vem das RLS policies.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey ? createClient(url, anonKey) : null
export const isSupabaseConfigured = Boolean(supabase)
