import { useState } from 'react'
import { COLORS, SERVICES, calcLineTotal, getQtyLabel } from '../lib/helpers'
import Toast from './Toast'

export default function InvoiceBuilder({ clients, dogs, onSaved, onCancel }) {
  const [step, setStep] = useState(1) // 1=select client, 2=select dates, 3=review
  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedDogs, setSelectedDogs] = useState([])
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [jobs, setJobs] = useState([])
  const [lineItems, setLineItems] = useState([])
  const [paymentNotes, setPaymentNotes] = useState('Payment due upon receipt. Cash or Venmo accepted. Thank you! 🐾')
  const [specialNotes, setSpecialNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const clientsWithDogs = clients.map(c => ({ ...c, dogs: dogs.filter(d => d.client_id === c.id) }))

  const handleSelectClient = (client) => {
    setSelectedClient(client)
    setSelectedDogs(client.dogs || [])
    setStep(2)
  }

  const loadJobs = async () => {
    if (!selectedClient || !periodStart || !periodEnd) {
      showToast('Please select both dates')
      return
    }
    const res = await fetch(
      `/api/schedule?client_id=${encodeURIComponent(selectedClient.id)}&start=${periodStart}&end=${periodEnd}`
    )
    const data = res.ok ? await res.json() : []

    setJobs(data)

    const items = data.map(job => ({
      job_id: job.id,
      service_idx: job.service_type || 1,
      date: job.job_date,
      qty: job.duration ? String(job.duration) : (job.service_type === 2 || job.service_type === 3 ? '1' : '15'),
      dog_name: job.dog_name || '',
    }))
    setLineItems(items.length > 0 ? items : [{ service_idx: 1, date: '', qty: '15', dog_name: '' }])
    setStep(3)
  }

  const updateLineItem = (i, field, val) => {
    setLineItems(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: val }; return n })
  }

  const addLineItem = () => setLineItems(prev => [...prev, { service_idx: 1, date: '', qty: '15', dog_name: '' }])
  const removeLineItem = (i) => setLineItems(prev => prev.filter((_, idx) => idx !== i))

  const total = lineItems.reduce((sum, item) => sum + calcLineTotal(item.service_idx, parseFloat(item.qty)), 0)

  const handleSave = async () => {
    setSaving(true)
    const dogNames = [...new Set(lineItems.map(i => i.dog_name).filter(Boolean))].join(', ')

    const payload = {
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      dog_names: dogNames || selectedDogs.map(d => d.name).join(', '),
      period_start: periodStart,
      period_end: periodEnd,
      special_notes: specialNotes,
      payment_notes: paymentNotes,
      line_items: lineItems,
      total,
      job_ids: lineItems.filter(i => i.job_id).map(i => i.job_id),
    }

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    console.log('[InvoiceBuilder] save response:', json)
    setSaving(false)

    if (!res.ok || json.error) {
      const msg = [json.error, json.hint, json.details].filter(Boolean).join(' | ')
      showToast('Error: ' + (msg || 'Save failed'))
      return
    }

    onSaved(json.data)
  }

  return (
    <div style={{ background: '#e8f4fd', minHeight: '100vh' }}>
      {toast && <Toast msg={toast} />}

      <div style={{ background: COLORS.blue, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>← Back</button>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: '1rem' }}>Invoice from Schedule</div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>Step {step} of 3</div>
      </div>

      <div style={{ padding: '16px', maxWidth: 700, margin: '0 auto' }}>

        {/* Step 1: Select Client */}
        {step === 1 && (
          <>
            <div style={{ fontWeight: 900, color: COLORS.navy, fontSize: '1rem', marginBottom: 14 }}>Select Client</div>
            {clientsWithDogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
                <div style={{ color: '#888' }}>No clients yet — add clients in the Clients tab first</div>
              </div>
            ) : clientsWithDogs.map(client => (
              <div key={client.id} onClick={() => handleSelectClient(client)}
                style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', cursor: 'pointer', borderLeft: `4px solid ${COLORS.blue}` }}>
                <div style={{ fontWeight: 900, color: COLORS.navy }}>{client.name}</div>
                {client.dogs.length > 0 && (
                  <div style={{ color: '#666', fontSize: '0.8rem', marginTop: 4 }}>
                    🐾 {client.dogs.map(d => d.name).join(', ')}
                  </div>
                )}
                {client.phone && <div style={{ color: '#888', fontSize: '0.75rem' }}>📞 {client.phone}</div>}
              </div>
            ))}
          </>
        )}

        {/* Step 2: Select dates */}
        {step === 2 && selectedClient && (
          <div style={{ background: '#fff', borderRadius: 14, padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
            <div style={{ fontWeight: 900, color: COLORS.navy, fontSize: '1rem', marginBottom: 4 }}>{selectedClient.name}</div>
            <div style={{ color: '#888', fontSize: '0.82rem', marginBottom: 20 }}>
              {selectedDogs.map(d => d.name).join(', ')}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.68rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>Service Period</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: '0.62rem', color: '#888', fontWeight: 700, marginBottom: 3 }}>FROM</div>
                  <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                    style={{ width: '100%', border: 'none', borderBottom: `2px solid ${COLORS.blue}`, fontSize: '0.9rem', padding: '4px 2px', outline: 'none', background: 'transparent', fontWeight: 600 }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.62rem', color: '#888', fontWeight: 700, marginBottom: 3 }}>TO</div>
                  <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                    style={{ width: '100%', border: 'none', borderBottom: `2px solid ${COLORS.blue}`, fontSize: '0.9rem', padding: '4px 2px', outline: 'none', background: 'transparent', fontWeight: 600 }} />
                </div>
              </div>
            </div>

            <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: 16, padding: '8px 10px', background: COLORS.lightBlue, borderRadius: 8 }}>
              💡 We&apos;ll pull all uninvoiced jobs for {selectedClient.name} in this date range
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: '12px', background: '#f5f5f5', border: 'none', borderRadius: 12, fontWeight: 700 }}>Back</button>
              <button onClick={loadJobs} disabled={!periodStart || !periodEnd}
                style={{ flex: 2, padding: '12px', background: !periodStart || !periodEnd ? '#ccc' : COLORS.coral, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800 }}>
                Pull Jobs →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & edit */}
        {step === 3 && (
          <>
            <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
              <div style={{ fontWeight: 900, color: COLORS.navy, marginBottom: 4 }}>{selectedClient.name}</div>
              {jobs.length > 0 ? (
                <div style={{ color: COLORS.green, fontSize: '0.82rem', fontWeight: 700 }}>✓ Found {jobs.length} job{jobs.length !== 1 ? 's' : ''} — review below</div>
              ) : (
                <div style={{ color: COLORS.coral, fontSize: '0.82rem', fontWeight: 700 }}>No scheduled jobs found — you can add items manually below</div>
              )}
            </div>

            <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
              <div style={{ background: COLORS.lightBlue, padding: '10px 16px', fontWeight: 800, color: COLORS.darkBlue, fontSize: '0.78rem', textTransform: 'uppercase' }}>
                Services
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
                  <thead>
                    <tr style={{ background: COLORS.lightBlue }}>
                      {['Service', 'Date', 'Min/Qty', 'Total', ''].map((h, i) => (
                        <th key={i} style={{ padding: '7px 8px', textAlign: i === 3 ? 'right' : 'left', color: COLORS.darkBlue, fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, i) => {
                      const tot = calcLineTotal(item.service_idx, parseFloat(item.qty))
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#f7fbfe' : '#fff' }}>
                          <td style={{ padding: '6px 8px', borderBottom: '1px dashed #eee' }}>
                            <select value={item.service_idx} onChange={e => updateLineItem(i, 'service_idx', parseInt(e.target.value))}
                              style={{ border: 'none', borderBottom: '1px dashed #ccd', fontSize: '0.8rem', padding: '3px 2px', width: '100%', background: 'transparent', color: '#111', outline: 'none', fontWeight: 600 }}>
                              {SERVICES.slice(1).map((s, si) => <option key={si} value={si+1}>{s.name}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px dashed #eee' }}>
                            <input type="date" value={item.date} onChange={e => updateLineItem(i, 'date', e.target.value)}
                              style={{ border: 'none', borderBottom: '1px dashed #ccd', fontSize: '0.75rem', padding: '3px 2px', width: '100%', background: 'transparent', color: '#111', outline: 'none', fontWeight: 600 }} />
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px dashed #eee', whiteSpace: 'nowrap' }}>
                            <input type="number" value={item.qty} onChange={e => updateLineItem(i, 'qty', e.target.value)} min="1"
                              style={{ border: 'none', borderBottom: '1px dashed #ccd', fontSize: '0.8rem', padding: '3px 2px', width: 40, background: 'transparent', color: '#111', outline: 'none', fontWeight: 600, textAlign: 'center' }} />
                            <span style={{ color: '#888', fontSize: '0.65rem', marginLeft: 2 }}>{getQtyLabel(item.service_idx)}</span>
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px dashed #eee', textAlign: 'right', fontWeight: 800, color: COLORS.coral, fontSize: '0.85rem' }}>
                            {tot > 0 ? `$${tot.toFixed(2)}` : ''}
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px dashed #eee' }}>
                            <button onClick={() => removeLineItem(i)}
                              style={{ background: COLORS.lightRed, border: 'none', borderRadius: 6, padding: '3px 7px', fontSize: '0.7rem', color: COLORS.coral, fontWeight: 700 }}>✕</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: '8px 16px' }}>
                <button onClick={addLineItem}
                  style={{ background: 'none', border: `2px dashed ${COLORS.blue}`, borderRadius: 8, padding: '7px 14px', color: COLORS.darkBlue, fontWeight: 700, fontSize: '0.82rem', width: '100%' }}>
                  + Add Line Item
                </button>
              </div>

              <div style={{ padding: '10px 16px', borderTop: `2px solid ${COLORS.lightBlue}` }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, paddingTop: 8, borderTop: `2px solid ${COLORS.blue}` }}>
                  <span style={{ color: COLORS.darkBlue, fontWeight: 900, fontSize: '1rem' }}>Total Due</span>
                  <span style={{ color: COLORS.coral, fontWeight: 900, fontSize: '1.1rem' }}>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
              <div style={{ fontSize: '0.68rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Special Instructions</div>
              <input value={specialNotes} onChange={e => setSpecialNotes(e.target.value)} placeholder="Any special notes..."
                style={{ width: '100%', border: 'none', borderBottom: '2px solid #ccd', fontSize: '0.9rem', padding: '3px 2px', outline: 'none', background: 'transparent', fontWeight: 600, marginBottom: 12 }} />
              <div style={{ fontSize: '0.68rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Payment Notes</div>
              <input value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)}
                style={{ width: '100%', border: 'none', borderBottom: '2px solid #ccd', fontSize: '0.9rem', padding: '3px 2px', outline: 'none', background: 'transparent', fontWeight: 600 }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, padding: '12px', background: '#f5f5f5', border: 'none', borderRadius: 12, fontWeight: 700 }}>Back</button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 2, padding: '12px', background: saving ? '#ccc' : COLORS.coral, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800 }}>
                {saving ? 'Saving...' : `Save Invoice — $${total.toFixed(2)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
