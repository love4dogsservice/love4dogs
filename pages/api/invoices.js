import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id, job_ids, ...body } = req.body

  const payload = {
    client_name: body.client_name || '',
    client_id: body.client_id || null,
    dog_names: body.dog_names || null,
    period_start: body.period_start || null,
    period_end: body.period_end || null,
    special_notes: body.special_notes || null,
    payment_notes: body.payment_notes || null,
    line_items: body.line_items || [],
    total: parseFloat(body.total) || 0,
  }

  let data, error

  if (id) {
    const result = await supabase
      .from('invoices')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    data = result.data
    error = result.error
  } else {
    const { data: existing } = await supabase
      .from('invoices')
      .select('invoice_number')
      .order('created_at', { ascending: false })
      .limit(1)

    let nextNum = '001'
    if (existing && existing.length > 0) {
      const max = Math.max(...existing.map(i => parseInt(i.invoice_number) || 0))
      nextNum = String(max + 1).padStart(3, '0')
    }

    const result = await supabase
      .from('invoices')
      .insert([{ ...payload, invoice_number: nextNum, paid: false }])
      .select()
      .single()
    data = result.data
    error = result.error
  }

  if (error) {
    console.error('Supabase error:', error)
    return res.status(400).json({ error: error.message, details: error })
  }

  // Mark schedule jobs as invoiced
  if (data && job_ids && job_ids.length > 0) {
    await supabase.from('schedule').update({ invoiced: true }).in('id', job_ids)
  }

  return res.status(200).json({ data })
}
