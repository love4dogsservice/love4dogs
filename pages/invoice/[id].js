import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { SERVICES, COLORS, calcLineTotal, getRateLabel, getQtyLabel, formatDateShort } from '../../lib/helpers'

export default function InvoicePage() {
  const router = useRouter()
  const { id } = router.query
  const [inv, setInv] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/invoices?id=${id}`)
      .then(r => r.json())
      .then(j => { if (j.data) setInv(j.data); else setError('Invoice not found') })
      .catch(() => setError('Could not load invoice'))
  }, [id])

  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#e05a3a', fontFamily: 'sans-serif' }}>{error}</div>
  if (!inv) return <div style={{ padding: 40, textAlign: 'center', color: '#888', fontFamily: 'sans-serif' }}>Loading…</div>

  const lineItems = typeof inv.line_items === 'string' ? JSON.parse(inv.line_items) : (inv.line_items || [])
  const rows = lineItems.filter(r => r.service_idx > 0)
  const total = rows.reduce((s, r) => s + calcLineTotal(r.service_idx, parseFloat(r.qty)), 0)
  const period = inv.period_start
    ? `${inv.period_start}${inv.period_end ? ' – ' + inv.period_end : ''}`
    : ''

  return (
    <>
      <Head>
        <title>Love 4 Dogs Invoice #{inv.invoice_number}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #e8f4fd; padding: 20px; }
        @media print {
          body { background: #fff; padding: 0; }
          .no-print { display: none !important; }
          .card { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; }
        }
      `}</style>

      <div className="no-print" style={{ maxWidth: 600, margin: '0 auto 16px', display: 'flex', gap: 10 }}>
        <button onClick={() => window.print()}
          style={{ flex: 1, background: '#5bbce4', color: '#fff', border: 'none', padding: '12px', borderRadius: 10, fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer' }}>
          🖨️ Print / Save as PDF
        </button>
      </div>

      <div className="card" style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', maxWidth: 600, margin: '0 auto', boxShadow: '0 2px 16px rgba(0,0,0,0.10)' }}>
        {/* Header */}
        <div style={{ background: COLORS.blue, padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.25rem' }}>Love 4 Dogs</div>
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.78rem', marginTop: 2 }}>Millie Ruth &amp; Ayres · 601-946-3924</div>
          </div>
          <div style={{ background: COLORS.coral, color: '#fff', fontWeight: 900, fontSize: '0.9rem', padding: '5px 14px', borderRadius: 8 }}>
            #{inv.invoice_number}
          </div>
        </div>

        <div style={{ padding: '18px 22px' }}>
          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${COLORS.lightBlue}` }}>
            <Meta label="Client" value={inv.client_name} />
            {inv.dog_names && <Meta label="Dog(s)" value={`🐾 ${inv.dog_names}`} />}
            {period && <div style={{ gridColumn: '1 / -1' }}><Meta label="Service Period" value={period} /></div>}
          </div>

          {inv.special_notes && (
            <div style={{ background: COLORS.lightBlue, borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: '0.82rem', color: COLORS.navy }}>
              📝 {inv.special_notes}
            </div>
          )}

          {/* Line items */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: 14 }}>
            <thead>
              <tr style={{ background: COLORS.lightBlue }}>
                {['Service', 'Date', 'Qty', 'Total'].map((h, i) => (
                  <th key={h} style={{ padding: '7px 8px', textAlign: i === 3 ? 'right' : 'left', color: COLORS.darkBlue, fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const tot = calcLineTotal(r.service_idx, parseFloat(r.qty))
                return (
                  <tr key={i} style={{ borderBottom: '1px dashed #eee' }}>
                    <td style={{ padding: '8px 8px', color: COLORS.navy, fontWeight: 600, verticalAlign: 'top' }}>
                      {SERVICES[r.service_idx]?.name}
                      <div style={{ color: '#888', fontSize: '0.68rem' }}>{getRateLabel(r.service_idx)}</div>
                    </td>
                    <td style={{ padding: '8px 8px', color: '#555', fontSize: '0.78rem', verticalAlign: 'top' }}>{r.date ? formatDateShort(r.date) : ''}</td>
                    <td style={{ padding: '8px 8px', color: '#555', verticalAlign: 'top' }}>{r.qty} {getQtyLabel(r.service_idx)}</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 800, color: COLORS.coral, verticalAlign: 'top' }}>${tot.toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, paddingTop: 10, borderTop: `2px solid ${COLORS.blue}`, marginBottom: 14 }}>
            <span style={{ fontWeight: 900, color: COLORS.darkBlue, fontSize: '1rem' }}>Total Due</span>
            <span style={{ fontWeight: 900, color: COLORS.coral, fontSize: '1.1rem' }}>${total.toFixed(2)}</span>
          </div>

          {inv.payment_notes && (
            <div style={{ padding: '10px 12px', border: '1px solid #eee', borderRadius: 8, fontSize: '0.82rem', color: '#555' }}>
              {inv.payment_notes}
            </div>
          )}
        </div>

        <div style={{ background: COLORS.blue, color: '#fff', textAlign: 'center', padding: '12px', fontSize: '0.85rem', fontWeight: 800 }}>
          Thank you for choosing Love 4 Dogs! 🐶 🐾🐾🐾
        </div>
      </div>
    </>
  )
}

function Meta({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.6rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontWeight: 700, color: COLORS.navy, fontSize: '0.9rem' }}>{value}</div>
    </div>
  )
}
