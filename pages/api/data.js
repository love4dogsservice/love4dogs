import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Missing Supabase environment variables' })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const [invRes, clientRes, dogRes] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('dogs').select('*').order('name'),
    ])

    if (invRes.error) console.error('[data] invoices error:', invRes.error)
    if (clientRes.error) console.error('[data] clients error:', clientRes.error)
    if (dogRes.error) console.error('[data] dogs error:', dogRes.error)

    return res.status(200).json({
      invoices: invRes.data || [],
      clients: clientRes.data || [],
      dogs: dogRes.data || [],
    })
  } catch (err) {
    console.error('[data] crash:', err)
    return res.status(500).json({ error: err.message })
  }
}
