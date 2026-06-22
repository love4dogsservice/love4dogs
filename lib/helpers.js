export const SERVICES = [
  { name: '-- Select Service --', rate: 0, type: 'none' },
  { name: 'Dog Walking', rate: 2.50, type: 'time' },
  { name: 'Feeding & Potty Break', rate: 4.00, type: 'visit' },
  { name: 'Potty Break Only', rate: 3.00, type: 'visit' },
  { name: 'Playtime & Companionship', rate: 2.50, type: 'time' },
]

export const COLORS = {
  blue: '#5bbce4',
  lightBlue: '#d6eef9',
  coral: '#e05a3a',
  darkBlue: '#1a6fa8',
  navy: '#1a3a5c',
  green: '#2d8a5a',
  lightGreen: '#e8f8f0',
  lightRed: '#fef0ed',
}

export function calcLineTotal(svcIdx, qty) {
  if (svcIdx < 1 || !qty || qty <= 0) return 0
  const s = SERVICES[svcIdx]
  if (s.type === 'time') return Math.ceil(qty / 15) * 2.50
  return qty * s.rate
}

export function getRateLabel(svcIdx) {
  if (svcIdx < 1) return ''
  const s = SERVICES[svcIdx]
  return s.type === 'time' ? '$2.50/15min' : `$${s.rate.toFixed(2)}/visit`
}

export function getQtyLabel(svcIdx) {
  if (svcIdx < 1) return ''
  return SERVICES[svcIdx].type === 'time' ? 'min' : 'visits'
}

export function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function emptyRows() {
  return Array(8).fill(null).map(() => ({ svc: 0, date: '', qty: '' }))
}

export function buildShareText(inv) {
  const rows = inv.rows
    .filter(r => r.svc > 0)
    .map(r => {
      const tot = calcLineTotal(r.svc, parseFloat(r.qty))
      return `  ${SERVICES[r.svc].name}${r.date ? ` (${r.date})` : ''} — $${tot.toFixed(2)}`
    }).join('\n')

  return `Love 4 Dogs Invoice #${inv.invoice_number}
Client: ${inv.client_name}${inv.dog_name ? ` | Dog: ${inv.dog_name}` : ''}${inv.service_period ? `\nPeriod: ${inv.service_period}` : ''}

${rows}

Total Due: $${Number(inv.total).toFixed(2)}

${inv.payment_notes || 'Payment due upon receipt. Cash or Venmo accepted.'}

Questions? Call/text 601-946-3924
— Millie Ruth & Ayres, Love 4 Dogs`
}

export function padInvoiceNum(n) {
  return String(n).padStart(3, '0')
}
