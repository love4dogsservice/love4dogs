import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  try {
    return await handleClients(req, res)
  } catch (err) {
    console.error('[clients] unhandled crash:', err)
    return res.status(500).json({
      error: err.message || 'Internal server error',
      stack: err.stack,
    })
  }
}

async function handleClients(req, res) {
  console.log('[clients] hit —', req.method, new Date().toISOString())

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  console.log('[clients] SUPABASE_URL present:', !!supabaseUrl)
  console.log('[clients] SUPABASE_KEY present:', !!supabaseKey)

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Missing Supabase environment variables',
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
    })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // DELETE /api/clients?id=xxx
  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'Missing id' })
    console.log('[clients] DELETE id:', id)
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) {
      console.error('[clients] delete error:', error)
      return res.status(400).json({ error: error.message, code: error.code, hint: error.hint })
    }
    return res.status(200).json({ ok: true })
  }

  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  console.log('[clients] body:', JSON.stringify(req.body, null, 2))

  const { id, name, phone, address, notes, dogs, initialDogIds } = req.body

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Client name is required' })
  }

  let clientId = id || null
  let clientData

  if (req.method === 'PUT' && id) {
    const { data, error } = await supabase
      .from('clients')
      .update({ name: name.trim(), phone: phone || '', address: address || '', notes: notes || '' })
      .eq('id', id)
      .select()
      .single()
    console.log('[clients] update result:', { data, error })
    if (error) {
      console.error('[clients] update error:', error)
      return res.status(400).json({ error: error.message, code: error.code, hint: error.hint, details: error.details })
    }
    clientData = data
    clientId = id
  } else {
    const { data, error } = await supabase
      .from('clients')
      .insert([{ name: name.trim(), phone: phone || '', address: address || '', notes: notes || '' }])
      .select()
      .single()
    console.log('[clients] insert result:', { data, error })
    if (error) {
      console.error('[clients] insert error:', error)
      return res.status(400).json({ error: error.message, code: error.code, hint: error.hint, details: error.details })
    }
    clientData = data
    clientId = data.id
  }

  const dogList = dogs || []
  for (const dog of dogList) {
    if (!dog.name || !dog.name.trim()) continue
    if (dog.id && !dog.isNew) {
      const { error } = await supabase
        .from('dogs')
        .update({ name: dog.name.trim(), breed: dog.breed || '', notes: dog.notes || '' })
        .eq('id', dog.id)
      if (error) console.error('[clients] dog update error:', error)
    } else {
      const { error } = await supabase
        .from('dogs')
        .insert([{ client_id: clientId, name: dog.name.trim(), breed: dog.breed || '', notes: dog.notes || '' }])
      if (error) console.error('[clients] dog insert error:', error)
    }
  }

  if (initialDogIds && initialDogIds.length > 0) {
    const keptIds = dogList.filter(d => d.id && !d.isNew).map(d => d.id)
    const toDelete = initialDogIds.filter(did => !keptIds.includes(did))
    for (const did of toDelete) {
      const { error } = await supabase.from('dogs').delete().eq('id', did)
      if (error) console.error('[clients] dog delete error:', error)
    }
  }

  return res.status(200).json({ data: clientData })
}
