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
  purple: '#9b59b6',
}

export const SERVICE_COLORS = {
  1: '#5bbce4',
  2: '#e05a3a',
  3: '#2d8a5a',
  4: '#9b59b6',
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

export function getDefaultQty(svcIdx) {
  if (svcIdx < 1) return ''
  return SERVICES[svcIdx].type === 'time' ? '30' : '1'
}

export function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateShort(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

export function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

export function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

export function dateToKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function padNum(n) {
  return String(n).padStart(3, '0')
}

export function buildShareText(inv) {
  const lineItems = typeof inv.line_items === 'string' ? JSON.parse(inv.line_items) : (inv.line_items || [])
  const lines = lineItems
    .filter(r => r.service_idx > 0)
    .map(r => {
      const tot = calcLineTotal(r.service_idx, parseFloat(r.qty))
      return `  ${SERVICES[r.service_idx]?.name}${r.date ? ` (${formatDateShort(r.date)})` : ''} — $${tot.toFixed(2)}`
    }).join('\n')

  const period = inv.period_start
    ? `${inv.period_start}${inv.period_end ? ' – ' + inv.period_end : ''}`
    : ''

  return `Love 4 Dogs Invoice #${inv.invoice_number}
Client: ${inv.client_name}${inv.dog_names ? ` | Dog(s): ${inv.dog_names}` : ''}${period ? `\nPeriod: ${period}` : ''}

${lines}

Total Due: $${Number(inv.total).toFixed(2)}

${inv.payment_notes || 'Payment due upon receipt. Cash or Venmo accepted.'}

Questions? Call/text 601-946-3924
— Millie Ruth & Ayres, Love 4 Dogs`
}

export function buildInvoiceHTML(inv) {
  const lineItems = typeof inv.line_items === 'string' ? JSON.parse(inv.line_items) : (inv.line_items || [])
  const rows = lineItems.filter(r => r.service_idx > 0)
  const period = inv.period_start
    ? `${inv.period_start}${inv.period_end ? ' – ' + inv.period_end : ''}`
    : ''

  const rowsHTML = rows.map(r => {
    const tot = calcLineTotal(r.service_idx, parseFloat(r.qty))
    return `<tr>
      <td>${SERVICES[r.service_idx]?.name || ''}<br><small style="color:#888">${getRateLabel(r.service_idx)}</small></td>
      <td>${r.date ? formatDateShort(r.date) : ''}</td>
      <td>${r.qty} ${getQtyLabel(r.service_idx)}</td>
      <td style="text-align:right;font-weight:800;color:#e05a3a">$${tot.toFixed(2)}</td>
    </tr>`
  }).join('')

  const total = rows.reduce((s, r) => s + calcLineTotal(r.service_idx, parseFloat(r.qty)), 0)

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Love 4 Dogs Invoice #${inv.invoice_number}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#e8f4fd;padding:20px}
  .card{background:#fff;border-radius:14px;overflow:hidden;max-width:600px;margin:0 auto;box-shadow:0 2px 16px rgba(0,0,0,0.10)}
  .header{background:#5bbce4;padding:18px 22px;display:flex;align-items:center;justify-content:space-between}
  .header-title{color:#fff;font-weight:900;font-size:1.25rem}
  .header-sub{color:rgba(255,255,255,0.9);font-size:0.78rem;margin-top:2px}
  .inv-num{background:#e05a3a;color:#fff;font-weight:900;font-size:0.9rem;padding:5px 14px;border-radius:8px}
  .body{padding:18px 22px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #d6eef9}
  .meta-label{font-size:0.6rem;color:#e05a3a;font-weight:800;text-transform:uppercase}
  .meta-value{font-weight:700;color:#1a3a5c;font-size:0.9rem}
  .notes{background:#d6eef9;border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:0.82rem;color:#1a3a5c}
  table{width:100%;border-collapse:collapse;font-size:0.82rem;margin-bottom:14px}
  th{background:#d6eef9;padding:7px 8px;text-align:left;color:#1a6fa8;font-size:0.65rem;text-transform:uppercase;font-weight:800}
  th:last-child{text-align:right}
  td{padding:8px 8px;border-bottom:1px dashed #eee;color:#1a3a5c;font-weight:600;vertical-align:top}
  .total-row{display:flex;justify-content:flex-end;gap:20px;padding-top:10px;border-top:2px solid #5bbce4;margin-bottom:14px}
  .total-label{font-weight:900;color:#1a6fa8;font-size:1rem}
  .total-val{font-weight:900;color:#e05a3a;font-size:1.1rem}
  .payment{padding:10px 12px;border:1px solid #eee;border-radius:8px;font-size:0.82rem;color:#555;margin-bottom:0}
  .footer{background:#5bbce4;color:#fff;text-align:center;padding:12px;font-size:0.85rem;font-weight:800}
  @media print{body{background:#fff;padding:0}.card{box-shadow:none;border-radius:0;max-width:100%}}
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div>
      <div class="header-title">Love 4 Dogs</div>
      <div class="header-sub">Millie Ruth &amp; Ayres &middot; 601-946-3924</div>
    </div>
    <div class="inv-num">#${inv.invoice_number}</div>
  </div>
  <div class="body">
    <div class="meta">
      <div><div class="meta-label">Client</div><div class="meta-value">${inv.client_name}</div></div>
      ${inv.dog_names ? `<div><div class="meta-label">Dog(s)</div><div class="meta-value">🐾 ${inv.dog_names}</div></div>` : ''}
      ${period ? `<div style="grid-column:1/-1"><div class="meta-label">Service Period</div><div class="meta-value">${period}</div></div>` : ''}
    </div>
    ${inv.special_notes ? `<div class="notes">📝 ${inv.special_notes}</div>` : ''}
    <table>
      <thead><tr><th>Service</th><th>Date</th><th>Qty</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${rowsHTML}</tbody>
    </table>
    <div class="total-row">
      <span class="total-label">Total Due</span>
      <span class="total-val">$${total.toFixed(2)}</span>
    </div>
    ${inv.payment_notes ? `<div class="payment">${inv.payment_notes}</div>` : ''}
  </div>
  <div class="footer">Thank you for choosing Love 4 Dogs! 🐶 🐾🐾🐾</div>
</div>
</body>
</html>`
}

export const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
export const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export function parseVoiceJob(transcript, clients = []) {
  const text = transcript.toLowerCase()
  const result = { client_name: '', dog_name: '', service_idx: 1, job_date: '', job_time: '', notes: '' }

  // Match service type
  if (text.includes('feed') || (text.includes('potty') && text.includes('food'))) result.service_idx = 2
  else if (text.includes('potty')) result.service_idx = 3
  else if (text.includes('play') || text.includes('companion')) result.service_idx = 4
  else result.service_idx = 1

  // Match by dog name first (across all clients), then fall back to client name
  let matched = false
  for (const c of clients) {
    for (const d of (c.dogs || [])) {
      if (d.name && text.includes(d.name.toLowerCase())) {
        result.client_id = c.id
        result.client_name = c.name
        result.dog_id = d.id
        result.dog_name = d.name
        matched = true
        break
      }
    }
    if (matched) break
  }
  if (!matched) {
    for (const c of clients) {
      if (text.includes(c.name.toLowerCase())) {
        result.client_id = c.id
        result.client_name = c.name
        if (c.dogs?.length === 1) {
          result.dog_id = c.dogs[0].id
          result.dog_name = c.dogs[0].name
        }
        break
      }
    }
  }

  // Parse time
  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
  if (timeMatch) {
    let h = parseInt(timeMatch[1])
    const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0
    const ampm = timeMatch[3].toLowerCase()
    if (ampm === 'pm' && h !== 12) h += 12
    if (ampm === 'am' && h === 12) h = 0
    result.job_time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
  }

  // Parse date
  const today = new Date()
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  for (let i = 0; i < days.length; i++) {
    if (text.includes(days[i])) {
      const diff = (i - today.getDay() + 7) % 7 || 7
      const d = new Date(today)
      d.setDate(today.getDate() + diff)
      result.job_date = d.toISOString().split('T')[0]
      break
    }
  }

  if (!result.job_date) {
    if (text.includes('today')) result.job_date = todayISO()
    else if (text.includes('tomorrow')) {
      const t = new Date()
      t.setDate(t.getDate() + 1)
      result.job_date = t.toISOString().split('T')[0]
    }
  }

  if (!result.job_date) {
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december']
    for (let mi = 0; mi < months.length; mi++) {
      if (text.includes(months[mi])) {
        const numMatch = text.match(new RegExp(months[mi] + '\\s+(\\d{1,2})'))
        if (numMatch) {
          const year = today.getFullYear()
          result.job_date = `${year}-${String(mi+1).padStart(2,'0')}-${String(parseInt(numMatch[1])).padStart(2,'0')}`
          break
        }
      }
    }
  }

  return result
}
