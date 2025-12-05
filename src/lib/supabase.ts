import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
}

// Validate that the URL is actually a URL
if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  throw new Error(
    `Invalid Supabase URL format. Expected a URL like "https://xxxxx.supabase.co", but got: "${supabaseUrl.substring(0, 50)}..."\n\n` +
    'Please check your .env.local file. The VITE_SUPABASE_URL should be your Supabase project URL, not a key.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

