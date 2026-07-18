import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://sitrnfhvhrxvjnjterex.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdHJuZmh2aHJ4dmpuanRlcmV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMDU5MzcsImV4cCI6MjA5OTU4MTkzN30.ESzx9G-MBilPny1a0SjyrOYwMmulcx5ozTpdOXaWtpw'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)