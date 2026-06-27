import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  // DELETE /api/clients?id=xxx
  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'Missing id' })
    console.log('[clients] DELETE id:', id)
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) { console.error('[clients] delete error:', error); return res.status(400).json({ error: error.message }) }
    return res.status(200).json({ ok: true })
  }

  // POST = create, PUT = update
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id, name, phone, address, notes, dogs } = req.body
  console.log('[clients] incoming body:', JSON.stringify(req.body, null, 2))

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Client name is required' })
  }

  let clientId = id || null
  let clientData

  if (req.method === 'PUT' && id) {
    // Update existing client
    const { data, error } = await supabase
      .from('clients')
      .update({ name: name.trim(), phone: phone || '', address: address || '', notes: notes || '' })
      .eq('id', id)
      .select()
      .single()
    console.log('[clients] update result:', { data, error })
    if (error) { console.error('[clients] update error:', error); return res.status(400).json({ error: error.message }) }
    clientData = data
    clientId = id
  } else {
    // Insert new client
    const { data, error } = await supabase
      .from('clients')
      .insert([{ name: name.trim(), phone: phone || '', address: address || '', notes: notes || '' }])
      .select()
      .single()
    console.log('[clients] insert result:', { data, error })
    if (error) { console.error('[clients] insert error:', error); return res.status(400).json({ error: error.message }) }
    clientData = data
    clientId = data.id
  }

  // Upsert dogs
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

  // Delete removed dogs (pass initialDogIds so server knows which to remove)
  const { initialDogIds } = req.body
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
