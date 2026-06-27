import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  console.log('[invoices] hit —', req.method, new Date().toISOString())
  console.log('[invoices] headers:', JSON.stringify(req.headers, null, 2))
  console.log('[invoices] body:', JSON.stringify(req.body, null, 2))

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!req.body || typeof req.body !== 'object') {
    console.error('[invoices] body not parsed — check Content-Type header')
    return res.status(400).json({ error: 'Request body missing or not JSON' })
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
    line_items: JSON.stringify(body.line_items || []),
    total: parseFloat(body.total) || 0,
  }

  console.log('[invoices] payload to Supabase:', JSON.stringify(payload, null, 2))

  let data, error

  if (id) {
    console.log('[invoices] updating id:', id)
    const result = await supabase
      .from('invoices')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    data = result.data
    error = result.error
  } else {
    // Fetch all invoice_numbers to find the true max
    const { data: allInvoices, error: fetchErr } = await supabase
      .from('invoices')
      .select('invoice_number')

    if (fetchErr) {
      console.error('[invoices] error fetching invoice numbers:', fetchErr)
      return res.status(400).json({ error: fetchErr.message, details: fetchErr, stage: 'fetch_invoice_numbers' })
    }

    let nextNum = '001'
    if (allInvoices && allInvoices.length > 0) {
      const max = Math.max(...allInvoices.map(i => parseInt(i.invoice_number) || 0))
      nextNum = String(max + 1).padStart(3, '0')
    }
    console.log('[invoices] next invoice_number:', nextNum)

    const result = await supabase
      .from('invoices')
      .insert([{ ...payload, invoice_number: nextNum, paid: false }])
      .select()
      .single()
    data = result.data
    error = result.error
  }

  console.log('[invoices] Supabase result — data:', JSON.stringify(data), 'error:', JSON.stringify(error))

  if (error) {
    console.error('[invoices] Supabase error:', error)
    return res.status(400).json({
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      full: error,
    })
  }

  // Mark schedule jobs as invoiced
  if (data && job_ids && job_ids.length > 0) {
    const { error: schedErr } = await supabase
      .from('schedule')
      .update({ invoiced: true })
      .in('id', job_ids)
    if (schedErr) console.error('[invoices] schedule update error:', schedErr)
  }

  return res.status(200).json({ data })
}
