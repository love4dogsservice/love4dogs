import { useState } from 'react'
import { SERVICES, COLORS, calcLineTotal, getRateLabel, getQtyLabel } from '../lib/helpers'
import Toast from './Toast'

const inputStyle = { width: '100%', border: 'none', borderBottom: '2px solid #ccd', fontSize: '0.9rem', padding: '4px 2px', outline: 'none', color: '#111', background: 'transparent', fontWeight: 600 }

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: '0.68rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  )
}

export default function InvoiceForm({ initial, clients, dogs, onSave, onCancel }) {
  const emptyItems = () => Array(8).fill(null).map(() => ({ service_idx: 0, date: '', qty: '' }))

  const [clientName, setClientName] = useState(initial?.client_name || '')
  const [dogNames, setDogNames] = useState(initial?.dog_names || '')
  const [periodStart, setPeriodStart] = useState(initial?.period_start || '')
  const [periodEnd, setPeriodEnd] = useState(initial?.period_end || '')
  const [specialNotes, setSpecialNotes] = useState(initial?.special_notes || '')
  const [paymentNotes, setPaymentNotes] = useState(initial?.payment_notes || 'Payment due upon receipt. Cash or Venmo accepted. Thank you! 🐾')
  const [lineItems, setLineItems] = useState(initial?.line_items || emptyItems())
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const updateItem = (i, field, val) => {
    setLineItems(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: field === 'service_idx' ? parseInt(val) : val }; return n })
  }

  const total = lineItems.reduce((sum, item) => sum + calcLineTotal(item.service_idx, parseFloat(item.qty)), 0)

  const handleSave = async () => {
    if (!clientName.trim()) { showToast('Please enter a client name'); return }
    setSaving(true)
    try {
      console.log('[InvoiceForm] calling onSave')
      await onSave({
        client_id: initial?.client_id || null,
        client_name: clientName.trim(),
        dog_names: dogNames.trim(),
        period_start: periodStart || null,
        period_end: periodEnd || null,
        special_notes: specialNotes.trim(),
        payment_notes: paymentNotes.trim(),
        line_items: lineItems,
        total,
      })
    } catch (e) {
      console.error('[InvoiceForm] save error:', e)
      showToast('Error saving: ' + (e.message || e))
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#e8f4fd', minHeight: '100vh' }}>
      {toast && <Toast msg={toast} />}

      <div style={{ background: COLORS.blue, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>← Back</button>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: '1rem' }}>{initial ? `Edit Invoice #${initial.invoice_number}` : 'Manual Invoice'}</div>
        <button onClick={handleSave} disabled={saving} style={{ background: saving ? '#aaa' : COLORS.coral, border: 'none', color: '#fff', padding: '8px 18px', borderRadius: 16, fontSize: '0.85rem', fontWeight: 800 }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div style={{ padding: '14px 16px', maxWidth: 700, margin: '0 auto' }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
          <Field label="Client Name *"><input value={clientName} onChange={e => setClientName(e.target.value)} style={inputStyle} /></Field>
          <Field label="Dog(s)"><input value={dogNames} onChange={e => setDogNames(e.target.value)} placeholder="e.g. Buddy, Max" style={inputStyle} /></Field>
          <Field label="Service Period">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.62rem', color: '#888', fontWeight: 700, marginBottom: 2 }}>FROM</div>
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} style={{ ...inputStyle, borderBottomColor: COLORS.blue }} />
              </div>
              <div>
                <div style={{ fontSize: '0.62rem', color: '#888', fontWeight: 700, marginBottom: 2 }}>TO</div>
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} style={{ ...inputStyle, borderBottomColor: COLORS.blue }} />
              </div>
            </div>
          </Field>
          <Field label="Special Instructions"><input value={specialNotes} onChange={e => setSpecialNotes(e.target.value)} placeholder="Any notes..." style={inputStyle} /></Field>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
          <div style={{ background: COLORS.lightBlue, padding: '10px 16px', fontWeight: 800, color: COLORS.darkBlue, fontSize: '0.78rem', textTransform: 'uppercase' }}>Services</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
              <thead>
                <tr style={{ background: COLORS.lightBlue }}>
                  {['Service','Date','Min/Qty','Rate','Total'].map((h,i) => (
                    <th key={i} style={{ padding: '7px 8px', textAlign: i===4?'right':'left', color: COLORS.darkBlue, fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, i) => {
                  const tot = calcLineTotal(item.service_idx, parseFloat(item.qty))
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#f7fbfe' : '#fff' }}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px dashed #eee' }}>
                        <select value={item.service_idx} onChange={e => updateItem(i, 'service_idx', e.target.value)}
                          style={{ border: 'none', borderBottom: '1px dashed #ccd', fontSize: '0.82rem', padding: '3px 2px', width: '100%', background: 'transparent', color: '#111', outline: 'none', fontWeight: 600 }}>
                          {SERVICES.map((s, si) => <option key={si} value={si}>{s.name}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px dashed #eee' }}>
                        <input type="date" value={item.date} onChange={e => updateItem(i, 'date', e.target.value)}
                          style={{ border: 'none', borderBottom: '1px dashed #ccd', fontSize: '0.75rem', padding: '3px 2px', width: '100%', background: 'transparent', outline: 'none', fontWeight: 600 }} />
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px dashed #eee', whiteSpace: 'nowrap' }}>
                        <input type="number" value={item.qty} onChange={e => updateItem(i, 'qty', e.target.value)} min="1"
                          style={{ border: 'none', borderBottom: '1px dashed #ccd', fontSize: '0.82rem', padding: '3px 2px', width: 40, background: 'transparent', outline: 'none', fontWeight: 600, textAlign: 'center' }} />
                        {item.service_idx > 0 && <span style={{ color: '#888', fontSize: '0.65rem', marginLeft: 2 }}>{getQtyLabel(item.service_idx)}</span>}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px dashed #eee', color: '#888', fontSize: '0.72rem' }}>{getRateLabel(item.service_idx)}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px dashed #eee', textAlign: 'right', fontWeight: 800, color: COLORS.coral, fontSize: '0.85rem' }}>{tot > 0 ? `$${tot.toFixed(2)}` : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 16px', borderTop: `2px solid ${COLORS.lightBlue}` }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, paddingTop: 8, borderTop: `2px solid ${COLORS.blue}` }}>
              <span style={{ color: COLORS.darkBlue, fontWeight: 900, fontSize: '1rem' }}>Total Due</span>
              <span style={{ color: COLORS.coral, fontWeight: 900, fontSize: '1.1rem' }}>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
          <Field label="Payment Notes"><input value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} style={inputStyle} /></Field>
        </div>

        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', background: saving ? '#aaa' : COLORS.coral, color: '#fff', border: 'none', padding: '14px', borderRadius: 14, fontSize: '1rem', fontWeight: 800 }}>
          {saving ? 'Saving...' : 'Save Invoice'}
        </button>
      </div>
    </div>
  )
}
