import { useState } from 'react'
import { SERVICES, COLORS, calcLineTotal, getRateLabel, getQtyLabel, emptyRows } from '../lib/helpers'
import Toast from './Toast'

function FormField({ label, value, onChange, placeholder, textarea, required }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: '0.7rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 3 }}>
        {label}{required && ' *'}
      </div>
      {textarea ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || ''}
          rows={2}
          style={{
            width: '100%', border: 'none', borderBottom: '2px solid #ccd',
            fontSize: '0.9rem', padding: '3px 2px', outline: 'none',
            color: '#111', background: 'transparent', fontWeight: 600,
            minHeight: 40,
          }}
        />
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || ''}
          style={{
            width: '100%', border: 'none', borderBottom: '2px solid #ccd',
            fontSize: '0.9rem', padding: '3px 2px', outline: 'none',
            color: '#111', background: 'transparent', fontWeight: 600,
          }}
        />
      )}
    </div>
  )
}

export default function InvoiceForm({ initial, nextNum, onSave, onCancel }) {
  const [clientName, setClientName] = useState(initial?.client_name || '')
  const [dogName, setDogName] = useState(initial?.dog_name || '')
  const [period, setPeriod] = useState(initial?.service_period || '')
  const [specialNotes, setSpecialNotes] = useState(initial?.special_notes || '')
  const [paymentNotes, setPaymentNotes] = useState(initial?.payment_notes || 'Payment due upon receipt. Cash or Venmo accepted. Thank you! 🐾')
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
    if (!clientName.trim()) { showToast('Please enter a client name'); return }
    setSaving(true)
    try {
      await onSave({
        client_name: clientName,
        dog_name: dogName,
        service_period: period,
        special_notes: specialNotes,
        payment_notes: paymentNotes,
        rows,
        total: subtotal,
      })
    } catch (e) {
      showToast('Error saving — try again')
    }
    setSaving(false)
  }

  return (
    <div style={{ fontFamily: 'inherit', background: '#e8f4fd', minHeight: '100vh' }}>
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
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: saving ? '#ccc' : COLORS.coral, border: 'none', color: '#fff',
            padding: '8px 18px', borderRadius: 16, fontSize: '0.85rem', fontWeight: 800,
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div style={{ padding: '14px 16px', maxWidth: 700, margin: '0 auto' }}>
        {/* Client info */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
          <FormField label="Client Name" value={clientName} onChange={setClientName} required />
          <FormField label="Dog's Name" value={dogName} onChange={setDogName} />
          <FormField label="Service Period" value={period} onChange={setPeriod} placeholder="e.g. June 1 – June 7" />
          <FormField label="Special Instructions" value={specialNotes} onChange={setSpecialNotes} placeholder="e.g. use side gate, allergic to..." textarea />
        </div>

        {/* Services table */}
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
          <div style={{ background: COLORS.lightBlue, padding: '10px 16px' }}>
            <div style={{ fontWeight: 800, color: COLORS.darkBlue, fontSize: '0.8rem', textTransform: 'uppercase' }}>Services</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 460 }}>
              <thead>
                <tr style={{ background: COLORS.lightBlue }}>
                  {['Service', 'Date', 'Min/Qty', 'Rate', 'Total'].map((h, i) => (
                    <th key={i} style={{
                      padding: '7px 8px', textAlign: i === 4 ? 'right' : 'left',
                      color: COLORS.darkBlue, fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 800
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const tot = calcLineTotal(row.svc, parseFloat(row.qty))
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#f7fbfe' : '#fff' }}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px dashed #e8e8e8' }}>
                        <select
                          value={row.svc}
                          onChange={e => updateRow(i, 'svc', e.target.value)}
                          style={{ border: 'none', borderBottom: '1px dashed #ccd', fontSize: '0.82rem', padding: '3px 2px', width: '100%', background: 'transparent', color: '#111', outline: 'none', fontWeight: 600 }}
                        >
                          {SERVICES.map((s, si) => <option key={si} value={si}>{s.name}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px dashed #e8e8e8' }}>
                        <input
                          value={row.date}
                          onChange={e => updateRow(i, 'date', e.target.value)}
                          placeholder="Mon 6/1"
                          style={{ border: 'none', borderBottom: '1px dashed #ccd', fontSize: '0.82rem', padding: '3px 2px', width: '100%', background: 'transparent', color: '#111', outline: 'none', fontWeight: 600 }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px dashed #e8e8e8', whiteSpace: 'nowrap' }}>
                        <input
                          type="number"
                          value={row.qty}
                          onChange={e => updateRow(i, 'qty', e.target.value)}
                          placeholder="--"
                          min="1"
                          style={{ border: 'none', borderBottom: '1px dashed #ccd', fontSize: '0.82rem', padding: '3px 2px', width: 40, background: 'transparent', color: '#111', outline: 'none', fontWeight: 600, textAlign: 'center' }}
                        />
                        {row.svc > 0 && <span style={{ color: '#888', fontSize: '0.68rem', marginLeft: 2 }}>{getQtyLabel(row.svc)}</span>}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px dashed #e8e8e8', color: '#888', fontSize: '0.75rem' }}>
                        {getRateLabel(row.svc)}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px dashed #e8e8e8', textAlign: 'right', fontWeight: 800, color: COLORS.coral, fontSize: '0.85rem' }}>
                        {tot > 0 ? `$${tot.toFixed(2)}` : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
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
        <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
          <FormField label="Payment Notes" value={paymentNotes} onChange={setPaymentNotes} textarea />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', background: saving ? '#ccc' : COLORS.coral, color: '#fff', border: 'none',
            padding: '14px', borderRadius: 14, fontSize: '1rem', fontWeight: 800,
          }}
        >
          {saving ? 'Saving...' : 'Save Invoice'}
        </button>
      </div>
    </div>
  )
}
