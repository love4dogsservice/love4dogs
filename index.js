import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { id, ...body } = req.body

    // Clean up empty date strings — send null instead
    const payload = {
      client_name: body.client_name || '',
      dog_name: body.dog_name || null,
      service_period_start: body.service_period_start || null,
      service_period_end: body.service_period_end || null,
      special_notes: body.special_notes || null,
      payment_notes: body.payment_notes || null,
      rows: body.rows || [],
      total: parseFloat(body.total) || 0,
    }

    let data, error

    if (id) {
      // Update existing
      const result = await supabase
        .from('invoices')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      data = result.data
      error = result.error
    } else {
      // Get next invoice number
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

    return res.status(200).json({ data })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
