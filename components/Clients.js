import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { COLORS } from '../lib/helpers'
import Toast from './Toast'

export default function Clients({ clients, dogs, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [editClient, setEditClient] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const handleDelete = async (id) => {
    if (!confirm('Delete this client and all their dogs?')) return
    await supabase.from('clients').delete().eq('id', id)
    onRefresh()
    showToast('Client deleted')
  }

  return (
    <div style={{ padding: '14px 16px', maxWidth: 700, margin: '0 auto' }}>
      {toast && <Toast msg={toast} />}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <button onClick={() => { setEditClient(null); setShowForm(true) }}
          style={{ background: COLORS.coral, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 20, fontSize: '0.9rem', fontWeight: 800 }}>
          + Add Client
        </button>
      </div>

      {clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>👤</div>
          <div style={{ fontWeight: 800, color: COLORS.navy, marginBottom: 8 }}>No clients yet</div>
          <div style={{ color: '#777', fontSize: '0.9rem', marginBottom: 20 }}>Add your first client to get started</div>
          <button onClick={() => { setEditClient(null); setShowForm(true) }}
            style={{ background: COLORS.coral, color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 20, fontSize: '1rem', fontWeight: 800 }}>
            + Add Client
          </button>
        </div>
      ) : (
        clients.map(client => {
          const clientDogs = dogs.filter(d => d.client_id === client.id)
          return (
            <div key={client.id} style={{
              background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 10,
              boxShadow: '0 2px 10px rgba(0,0,0,0.07)', borderLeft: `4px solid ${COLORS.blue}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, color: COLORS.navy, fontSize: '1rem' }}>{client.name}</div>
                  {client.phone && <div style={{ color: '#666', fontSize: '0.8rem', marginTop: 2 }}>📞 {client.phone}</div>}
                  {client.address && <div style={{ color: '#666', fontSize: '0.8rem', marginTop: 1 }}>📍 {client.address}</div>}
                  {clientDogs.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {clientDogs.map(dog => (
                        <span key={dog.id} style={{
                          background: COLORS.lightBlue, color: COLORS.darkBlue,
                          fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                        }}>🐾 {dog.name}{dog.breed ? ` (${dog.breed})` : ''}</span>
                      ))}
                    </div>
                  )}
                  {client.notes && <div style={{ color: '#888', fontSize: '0.75rem', marginTop: 6, fontStyle: 'italic' }}>{client.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, marginLeft: 10 }}>
                  <button onClick={() => { setEditClient(client); setShowForm(true) }}
                    style={{ background: COLORS.lightBlue, border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700, color: COLORS.darkBlue }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(client.id)}
                    style={{ background: COLORS.lightRed, border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700, color: COLORS.coral }}>
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )
        })
      )}

      {showForm && (
        <ClientForm
          initial={editClient}
          initialDogs={editClient ? dogs.filter(d => d.client_id === editClient.id) : []}
          onSave={async () => { await onRefresh(); setShowForm(false); setEditClient(null); showToast('Client saved!') }}
          onCancel={() => { setShowForm(false); setEditClient(null) }}
        />
      )}
    </div>
  )
}

function ClientForm({ initial, initialDogs, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [phone, setPhone] = useState(initial?.phone || '')
  const [address, setAddress] = useState(initial?.address || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [dogList, setDogList] = useState(initialDogs.length > 0 ? initialDogs : [{ name: '', breed: '', notes: '', isNew: true }])
  const [saving, setSaving] = useState(false)

  const addDog = () => setDogList(prev => [...prev, { name: '', breed: '', notes: '', isNew: true }])
  const removeDog = (i) => setDogList(prev => prev.filter((_, idx) => idx !== i))
  const updateDog = (i, field, val) => setDogList(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: val }; return n })

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)

    let clientId = initial?.id
    if (initial) {
      await supabase.from('clients').update({ name: name.trim(), phone, address, notes }).eq('id', initial.id)
    } else {
      const { data } = await supabase.from('clients').insert([{ name: name.trim(), phone, address, notes }]).select().single()
      clientId = data.id
    }

    for (const dog of dogList) {
      if (!dog.name.trim()) continue
      if (dog.id && !dog.isNew) {
        await supabase.from('dogs').update({ name: dog.name, breed: dog.breed, notes: dog.notes }).eq('id', dog.id)
      } else {
        await supabase.from('dogs').insert([{ client_id: clientId, name: dog.name, breed: dog.breed, notes: dog.notes }])
      }
    }

    const keptIds = dogList.filter(d => d.id && !d.isNew).map(d => d.id)
    const removedDogs = initialDogs.filter(d => !keptIds.includes(d.id))
    for (const d of removedDogs) {
      await supabase.from('dogs').delete().eq('id', d.id)
    }

    setSaving(false)
    await onSave()
  }

  const F = ({ label, value, onChange, placeholder }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: '0.68rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || ''}
        style={{ width: '100%', border: 'none', borderBottom: '2px solid #ccd', fontSize: '0.9rem', padding: '4px 2px', outline: 'none', color: '#111', background: 'transparent', fontWeight: 600 }} />
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 200, overflowY: 'auto' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 20px 40px', width: '100%', maxWidth: 700, margin: '0 auto', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontWeight: 900, color: COLORS.navy, fontSize: '1rem' }}>{initial ? 'Edit Client' : 'Add Client'}</div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: '1.4rem', color: '#aaa' }}>✕</button>
        </div>

        <F label="Client Name *" value={name} onChange={setName} />
        <F label="Phone" value={phone} onChange={setPhone} placeholder="601-555-1234" />
        <F label="Address" value={address} onChange={setAddress} placeholder="123 Main St" />
        <F label="Notes" value={notes} onChange={setNotes} placeholder="Gate code, parking, etc." />

        <div style={{ marginTop: 16, marginBottom: 8 }}>
          <div style={{ fontWeight: 900, color: COLORS.navy, fontSize: '0.9rem', marginBottom: 10 }}>🐾 Dogs</div>
          {dogList.map((dog, i) => (
            <div key={i} style={{ background: COLORS.lightBlue, borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>Dog Name *</div>
                  <input value={dog.name} onChange={e => updateDog(i, 'name', e.target.value)}
                    style={{ width: '100%', border: 'none', borderBottom: '1px solid #aac', fontSize: '0.88rem', padding: '3px 2px', outline: 'none', background: 'transparent', fontWeight: 600 }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }}>Breed</div>
                  <input value={dog.breed} onChange={e => updateDog(i, 'breed', e.target.value)}
                    style={{ width: '100%', border: 'none', borderBottom: '1px solid #aac', fontSize: '0.88rem', padding: '3px 2px', outline: 'none', background: 'transparent', fontWeight: 600 }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <input value={dog.notes} onChange={e => updateDog(i, 'notes', e.target.value)} placeholder="Allergies, temperament, etc."
                  style={{ flex: 1, border: 'none', borderBottom: '1px solid #aac', fontSize: '0.82rem', padding: '3px 2px', outline: 'none', background: 'transparent', fontWeight: 600, marginRight: 8 }} />
                {dogList.length > 1 && (
                  <button onClick={() => removeDog(i)} style={{ background: COLORS.lightRed, border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: '0.75rem', color: COLORS.coral, fontWeight: 700 }}>✕</button>
                )}
              </div>
            </div>
          ))}
          <button onClick={addDog} style={{ background: 'none', border: `2px dashed ${COLORS.blue}`, borderRadius: 10, padding: '8px 16px', color: COLORS.darkBlue, fontWeight: 700, fontSize: '0.85rem', width: '100%' }}>
            + Add Another Dog
          </button>
        </div>

        <button onClick={handleSave} disabled={saving || !name.trim()}
          style={{ width: '100%', marginTop: 16, background: saving || !name.trim() ? '#ccc' : COLORS.coral, color: '#fff', border: 'none', padding: '14px', borderRadius: 14, fontSize: '1rem', fontWeight: 800 }}>
          {saving ? 'Saving...' : initial ? 'Update Client' : 'Save Client'}
        </button>
      </div>
    </div>
  )
}
