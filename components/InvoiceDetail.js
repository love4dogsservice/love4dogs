import { useState } from 'react'
import { SERVICES, COLORS, calcLineTotal, getRateLabel, getQtyLabel, formatDate, buildShareText } from '../lib/helpers'
import Toast from './Toast'

export default function InvoiceDetail({ inv, onEdit, onBack, onTogglePaid, onDelete, onUpdate }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [toast, setToast] = useState(null)
  const [toggling, setToggling] = useState(false)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleTogglePaid = async () => {
    setToggling(true)
    await onTogglePaid()
    setToggling(false)
    showToast(inv.paid ? 'Marked as unpaid' : 'Marked as paid! 🎉')
  }

  const handleEmail = () => {
    const text = buildShareText(inv)
    const subject = encodeURIComponent(`Love 4 Dogs Invoice #${inv.invoice_number} — $${Number(inv.total).toFixed(2)}`)
    const body = encodeURIComponent(text)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const handleText = () => {
    const text = encodeURIComponent(buildShareText(inv))
    window.location.href = `sms:?body=${text}`
  }

  const handleCopy = async () => {
    const text = buildShareText(inv)
    try {
      await navigator.clipboard.writeText(text)
      showToast('Copied to clipboard!')
    } catch {
      showToast('Copy failed — try again')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const filledRows = inv.rows ? inv.rows.filter(r => r.svc > 0) : []

  return (
    <div style={{ fontFamily: 'inherit', background: '#e8f4fd', minHeight: '100vh' }}>
      {toast && <Toast msg={toast} />}

      {/* Nav */}
      <div className="no-print" style={{
        background: COLORS.blue, padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>←</button>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: '1rem' }}>Invoice #{inv.invoice_number}</div>
        <button onClick={onEdit} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>Edit</button>
      </div>

      <div style={{ padding: '16px', maxWidth: 700, margin: '0 auto' }}>

        {/* Status card */}
        <div className="no-print" style={{
          background: '#fff', borderRadius: 14, padding: '14px 16px',
          marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 900, color: COLORS.navy, fontSize: '1.15rem' }}>{inv.client_name}</div>
              {inv.dog_name && <div style={{ color: '#666', fontSize: '0.85rem', marginTop: 2 }}>🐾 {inv.dog_name}</div>}
              {inv.service_period && <div style={{ color: '#888', fontSize: '0.78rem', marginTop: 2 }}>{inv.service_period}</div>}
              <div style={{ color: '#aaa', fontSize: '0.75rem', marginTop: 4 }}>{formatDate(inv.created_at)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 900, color: COLORS.coral, fontSize: '1.6rem' }}>${Number(inv.total).toFixed(2)}</div>
              <div style={{
                display: 'inline-block', marginTop: 4,
                background: inv.paid ? COLORS.lightGreen : COLORS.lightRed,
                color: inv.paid ? COLORS.green : COLORS.coral,
                fontSize: '0.68rem', fontWeight: 800, padding: '3px 10px',
                borderRadius: 10, textTransform: 'uppercase',
              }}>
                {inv.paid ? 'Paid' : 'Unpaid'}
              </div>
            </div>
          </div>

          <button
            onClick={handleTogglePaid}
            disabled={toggling}
            style={{
              width: '100%', padding: '11px', borderRadius: 10, border: 'none',
              background: inv.paid ? COLORS.lightRed : COLORS.lightGreen,
              color: inv.paid ? COLORS.coral : COLORS.green,
              fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
            }}
          >
            {toggling ? '...' : inv.paid ? 'Mark as Unpaid' : '✓ Mark as Paid'}
          </button>
        </div>

        {/* Share / action buttons */}
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { icon: '✉️', label: 'Email', action: handleEmail },
            { icon: '💬', label: 'Text', action: handleText },
            { icon: '📋', label: 'Copy', action: handleCopy },
            { icon: '🖨️', label: 'Print', action: handlePrint },
          ].map(({ icon, label, action }) => (
            <button key={label} onClick={action} style={{
              background: '#fff', border: 'none', borderRadius: 12, padding: '12px 4px',
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <span style={{ fontSize: '1.3rem' }}>{icon}</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: COLORS.navy }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Full invoice view */}
        <div className="card" style={{
          background: '#fff', borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 2px 10px rgba(0,0,0,0.07)', marginBottom: 12,
        }}>
          {/* Invoice header */}
          <div style={{ background: COLORS.blue, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.2rem' }}>Love 4 Dogs</div>
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.78rem', fontWeight: 600 }}>Millie Ruth &amp; Ayres · Neighborhood Pet Care</div>
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.78rem', fontWeight: 600 }}>📞 601-946-3924</div>
            </div>
            <div style={{ background: COLORS.coral, color: '#fff', fontWeight: 900, fontSize: '1rem', padding: '6px 14px', borderRadius: 8, letterSpacing: 1 }}>
              INVOICE #{inv.invoice_number}
            </div>
          </div>

          <div style={{ padding: '14px 20px' }}>
            {/* Client info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${COLORS.lightBlue}` }}>
              <div>
                <div style={{ fontSize: '0.65rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase' }}>Client</div>
                <div style={{ fontWeight: 700, color: COLORS.navy }}>{inv.client_name}</div>
              </div>
              {inv.dog_name && (
                <div>
                  <div style={{ fontSize: '0.65rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase' }}>Dog</div>
                  <div style={{ fontWeight: 700, color: COLORS.navy }}>{inv.dog_name}</div>
                </div>
              )}
              {inv.service_period && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '0.65rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase' }}>Service Period</div>
                  <div style={{ fontWeight: 600, color: '#333' }}>{inv.service_period}</div>
                </div>
              )}
            </div>

            {inv.special_notes && (
              <div style={{ background: COLORS.lightBlue, borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.82rem', color: COLORS.navy }}>
                📝 {inv.special_notes}
              </div>
            )}

            {/* Line items */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: 12 }}>
              <thead>
                <tr style={{ background: COLORS.lightBlue }}>
                  <th style={{ padding: '7px 8px', textAlign: 'left', color: COLORS.darkBlue, fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase' }}>Service</th>
                  <th style={{ padding: '7px 8px', textAlign: 'left', color: COLORS.darkBlue, fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase' }}>Date</th>
                  <th style={{ padding: '7px 8px', textAlign: 'left', color: COLORS.darkBlue, fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase' }}>Qty</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', color: COLORS.darkBlue, fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {filledRows.map((r, i) => {
                  const tot = calcLineTotal(r.svc, parseFloat(r.qty))
                  return (
                    <tr key={i} style={{ borderBottom: '1px dashed #eee' }}>
                      <td style={{ padding: '8px 8px', color: COLORS.navy, fontWeight: 600 }}>
                        {SERVICES[r.svc]?.name}
                        <div style={{ color: '#888', fontSize: '0.7rem' }}>{getRateLabel(r.svc)}</div>
                      </td>
                      <td style={{ padding: '8px 8px', color: '#555' }}>{r.date}</td>
                      <td style={{ padding: '8px 8px', color: '#555' }}>{r.qty} {getQtyLabel(r.svc)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 800, color: COLORS.coral }}>${tot.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, paddingTop: 10, borderTop: `2px solid ${COLORS.blue}` }}>
              <span style={{ fontWeight: 900, color: COLORS.darkBlue, fontSize: '1rem' }}>Total Due</span>
              <span style={{ fontWeight: 900, color: COLORS.coral, fontSize: '1.15rem' }}>${Number(inv.total).toFixed(2)}</span>
            </div>

            {inv.payment_notes && (
              <div style={{ marginTop: 12, padding: '10px 12px', border: '1px solid #eee', borderRadius: 8, fontSize: '0.8rem', color: '#555' }}>
                {inv.payment_notes}
              </div>
            )}
          </div>

          <div style={{ background: COLORS.blue, color: '#fff', textAlign: 'center', padding: '11px', fontSize: '0.85rem', fontWeight: 800 }}>
            Thank you for choosing Love 4 Dogs! 🐶 🐾🐾🐾
          </div>
        </div>

        {/* Delete */}
        <div className="no-print">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ width: '100%', background: 'none', border: '1px solid #ffbbb0', color: '#c94428', padding: '10px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700 }}
            >
              Delete Invoice
            </button>
          ) : (
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
              <div style={{ fontWeight: 800, color: COLORS.navy, marginBottom: 8 }}>Delete this invoice?</div>
              <div style={{ color: '#777', fontSize: '0.85rem', marginBottom: 14 }}>This can&apos;t be undone.</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '10px', background: '#f5f5f5', border: 'none', borderRadius: 10, fontWeight: 700 }}>Cancel</button>
                <button onClick={onDelete} style={{ flex: 1, padding: '10px', background: COLORS.coral, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700 }}>Delete</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
