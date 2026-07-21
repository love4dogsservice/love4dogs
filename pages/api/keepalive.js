import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ ok: false, error: 'Missing Supabase env vars' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { error } = await supabase.from('invoices').select('id').limit(1)

  if (error) {
    console.error('[keepalive] Supabase error:', error.message)
    return res.status(500).json({ ok: false, error: error.message })
  }

  console.log('[keepalive] ping ok', new Date().toISOString())
  return res.status(200).json({ ok: true, ts: new Date().toISOString() })
}
