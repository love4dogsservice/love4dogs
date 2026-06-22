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

export function formatDateShort(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}

export function emptyRows() {
  return Array(8).fill(null).map(() => ({ svc: 0, date: '', qty: '' }))
}

export function buildShareText(inv) {
  const rows = (inv.rows || [])
    .filter(r => r.svc > 0)
    .map(r => {
      const tot = calcLineTotal(r.svc, parseFloat(r.qty))
      return `  ${SERVICES[r.svc].name}${r.date ? ` (${r.date})` : ''} — $${tot.toFixed(2)}`
    }).join('\n')

  return `Love 4 Dogs Invoice #${inv.invoice_number}
Client: ${inv.client_name}${inv.dog_name ? ` | Dog: ${inv.dog_name}` : ''}${inv.service_period_start ? `\nPeriod: ${inv.service_period_start}${inv.service_period_end ? ' – ' + inv.service_period_end : ''}` : ''}

${rows}

Total Due: $${Number(inv.total).toFixed(2)}

${inv.payment_notes || 'Payment due upon receipt. Cash or Venmo accepted.'}

Questions? Call/text 601-946-3924
— Millie Ruth & Ayres, Love 4 Dogs`
}

export function padNum(n) {
  return String(n).padStart(3, '0')
}

// Calendar helpers
export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

export function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

export function toDateKey(date) {
  // Returns YYYY-MM-DD
  const d = new Date(date)
  return d.toISOString().split('T')[0]
}

export function todayKey() {
  return toDateKey(new Date())
}

export const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
