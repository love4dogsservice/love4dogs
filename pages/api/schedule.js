import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  try {
    return await handleSchedule(req, res)
  } catch (err) {
    console.error('[schedule] unhandled crash:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

async function handleSchedule(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase env vars' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  if (req.method === 'GET') {
    const { client_id, start, end } = req.query
    let query = supabase.from('schedule').select('*')
    if (client_id) query = query.eq('client_id', client_id)
    if (start) query = query.gte('job_date', start)
    if (end) query = query.lte('job_date', end)
    if (client_id) query = query.neq('invoiced', true) // catch false AND null
    query = query.order('job_date').order('job_time')
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const { data, error } = await supabase
      .from('schedule')
      .insert([req.body])
      .select()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data[0])
  }

  if (req.method === 'PUT') {
    const { id, ...payload } = req.body
    if (!id) return res.status(400).json({ error: 'Missing id' })
    const { data, error } = await supabase
      .from('schedule')
      .update(payload)
      .eq('id', id)
      .select()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data[0])
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'Missing id' })
    const { error } = await supabase.from('schedule').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
