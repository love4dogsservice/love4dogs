import { useState } from 'react'
import { SERVICES, COLORS, calcLineTotal, getRateLabel, getQtyLabel, emptyRows } from '../lib/helpers'
import Toast from './Toast'

const inputBase = {
  width: '100%', border: 'none', borderBottom: '2px solid #ccd',
  fontSize: '0.9rem', padding: '4px 2px', outline: 'none',
  color: '#111', background: 'transparent', fontWeight: 600,
}

function FormField({ label, value, onChange, placeholder, textarea, type }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: '0.68rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 3 }}>
        {label}
      </div>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder || ''} rows={2}
          style={{ ...inputBase, minHeight: 40 }} />
      ) : (
        <input type={type || 'text'} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || ''}
          style={inputBase} />
      )}
    </div>
  )
}

export default function InvoiceForm({ initial, nextNum, onSave, onCancel }) {
  const [clientName, setClientName] = useState(initial?.client_name || '')
  const [dogName, setDogName] = useState(initial?.dog_name || '')
  const [periodStart, setPeriodStart] = useState(initial?.service_period_start || '')
  const [periodEnd, setPeriodEnd] = useState(initial?.service_period_end || '')
  const [specialNotes, setSpecialNotes] = useState(initial?.special_notes || '')
  const [paymentNotes, setPaymentNotes] = useState(
    initial?.payment_notes || 'Payment due upon receipt. Cash or Venmo accepted. Thank you! 🐾'
  )
  const [rows, setRows] = useState(initial?.rows || emptyRows())
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const updateRow = (i, field, val) => {
    setRows(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: field === 'svc' ? parseInt(val) : val }
      return next
    })
  }

  const lineTotals = rows.map(r => calcLineTotal(r.svc, parseFloat(r.qty)))
  const subtotal = lineTotals.reduce((a, b) => a + b, 0)

  const handleSave = async () => {
    if (!clientName.trim()) {
      showToast('Please enter a client name')
      return
    }
    setSaving(true)
    try {
      await onSave({
        client_name: clientName.trim(),
        dog_name: dogName.trim(),
        service_period_start: periodStart,
        service_period_end: periodEnd,
        special_notes: specialNotes.trim(),
        payment_notes: paymentNotes.trim(),
        rows: rows,
        total: subtotal,
      })
    } catch (e) {
      console.error('Save error:', e)
      showToast('Error saving — please try again')
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#e8f4fd', minHeight: '100vh' }}>
      {toast && <Toast msg={toast} />}

      {/* Nav */}
      <div style={{
        background: COLORS.blue, padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>
          ← Back
        </button>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: '1rem' }}>
          {initial ? `Edit Invoice #${initial.invoice_number}` : `New Invoice #${nextNum}`}
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{ background: saving ? '#aaa' : COLORS.coral, border: 'none', color: '#fff', padding: '8px 18px', borderRadius: 16, fontSize: '0.85rem', fontWeight: 800 }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div style={{ padding: '14px 16px', maxWidth: 700, margin: '0 auto' }}>

        {/* Client info */}
        <Card>
          <FormField label="Client Name *" value={clientName} onChange={setClientName} />
          <FormField label="Dog's Name" value={dogName} onChange={setDogName} />
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.68rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>
              Service Period
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.62rem', color: '#888', fontWeight: 700, marginBottom: 3 }}>FROM</div>
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                  style={{ ...inputBase, borderBottom: `2px solid ${COLORS.blue}` }} />
              </div>
              <div>
                <div style={{ fontSize: '0.62rem', color: '#888', fontWeight: 700, marginBottom: 3 }}>TO</div>
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                  style={{ ...inputBase, borderBottom: `2px solid ${COLORS.blue}` }} />
              </div>
            </div>
          </div>
          <FormField label="Special Instructions" value={specialNotes} onChange={setSpecialNotes}
            placeholder="e.g. use side gate, allergic to..." textarea />
        </Card>

        {/* Services table */}
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
          <div style={{ background: COLORS.lightBlue, padding: '10px 16px' }}>
            <div style={{ fontWeight: 800, color: COLORS.darkBlue, fontSize: '0.78rem', textTransform: 'uppercase' }}>Services</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead>
                <tr style={{ background: COLORS.lightBlue }}>
                  {['Service', 'Date', 'Min/Qty', 'Rate', 'Total'].map((h, i) => (
                    <th key={i} style={{ padding: '7px 8px', textAlign: i === 4 ? 'right' : 'left', color: COLORS.darkBlue, fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const tot = calcLineTotal(row.svc, parseFloat(row.qty))
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#f7fbfe' : '#fff' }}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px dashed #eee' }}>
                        <select value={row.svc} onChange={e => updateRow(i, 'svc', e.target.value)}
                          style={{ border: 'none', borderBottom: '1px dashed #ccd', fontSize: '0.82rem', padding: '3px 2px', width: '100%', background: 'transparent', color: '#111', outline: 'none', fontWeight: 600 }}>
                          {SERVICES.map((s, si) => <option key={si} value={si}>{s.name}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px dashed #eee' }}>
                        <input type="date" value={row.date} onChange={e => updateRow(i, 'date', e.target.value)}
                          style={{ border: 'none', borderBottom: '1px dashed #ccd', fontSize: '0.78rem', padding: '3px 2px', width: '100%', background: 'transparent', color: '#111', outline: 'none', fontWeight: 600 }} />
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px dashed #eee', whiteSpace: 'nowrap' }}>
                        <input type="number" value={row.qty} onChange={e => updateRow(i, 'qty', e.target.value)}
                          placeholder="--" min="1"
                          style={{ border: 'none', borderBottom: '1px dashed #ccd', fontSize: '0.82rem', padding: '3px 2px', width: 40, background: 'transparent', color: '#111', outline: 'none', fontWeight: 600, textAlign: 'center' }} />
                        {row.svc > 0 && <span style={{ color: '#888', fontSize: '0.65rem', marginLeft: 2 }}>{getQtyLabel(row.svc)}</span>}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px dashed #eee', color: '#888', fontSize: '0.72rem' }}>
                        {getRateLabel(row.svc)}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px dashed #eee', textAlign: 'right', fontWeight: 800, color: COLORS.coral, fontSize: '0.85rem' }}>
                        {tot > 0 ? `$${tot.toFixed(2)}` : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ padding: '10px 16px', borderTop: `2px solid ${COLORS.lightBlue}` }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginBottom: 6 }}>
              <span style={{ color: '#777', fontWeight: 700 }}>Subtotal</span>
              <span style={{ fontWeight: 900 }}>${subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, paddingTop: 8, borderTop: `2px solid ${COLORS.blue}` }}>
              <span style={{ color: COLORS.darkBlue, fontWeight: 900, fontSize: '1rem' }}>Total Due</span>
              <span style={{ color: COLORS.coral, fontWeight: 900, fontSize: '1.1rem' }}>${subtotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment notes */}
        <Card>
          <FormField label="Payment Notes" value={paymentNotes} onChange={setPaymentNotes} textarea />
        </Card>

        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', background: saving ? '#aaa' : COLORS.coral, color: '#fff', border: 'none', padding: '14px', borderRadius: 14, fontSize: '1rem', fontWeight: 800, marginTop: 4 }}>
          {saving ? 'Saving...' : 'Save Invoice'}
        </button>
      </div>
    </div>
  )
}

function Card({ children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
      {children}
    </div>
  )
}
