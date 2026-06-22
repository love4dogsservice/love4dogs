import { useState, useEffect } from 'react'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import { COLORS, formatDate, formatDateShort, padNum } from '../lib/helpers'
import InvoiceForm from '../components/InvoiceForm'
import InvoiceDetail from '../components/InvoiceDetail'
import Schedule from '../components/Schedule'
import Toast from '../components/Toast'

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: color || COLORS.navy }}>{value}</div>
      <div style={{ fontSize: '0.62rem', color: '#888', fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function InvoiceCard({ inv, onClick }) {
  const periodStr = inv.service_period_start
    ? `${formatDateShort(inv.service_period_start)}${inv.service_period_end ? ' – ' + formatDateShort(inv.service_period_end) : ''}`
    : null

  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 10,
      boxShadow: '0 2px 10px rgba(0,0,0,0.07)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderLeft: `4px solid ${inv.paid ? COLORS.blue : COLORS.coral}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 900, color: COLORS.navy, fontSize: '0.95rem' }}>#{inv.invoice_number}</span>
          <span style={{
            background: inv.paid ? COLORS.lightGreen : COLORS.lightRed,
            color: inv.paid ? COLORS.green : COLORS.coral,
            fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase', flexShrink: 0,
          }}>{inv.paid ? 'Paid' : 'Unpaid'}</span>
        </div>
        <div style={{ fontWeight: 700, color: '#333', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {inv.client_name}
        </div>
        <div style={{ color: '#888', fontSize: '0.75rem', marginTop: 2 }}>
          {inv.dog_name && `🐾 ${inv.dog_name}`}
          {inv.dog_name && periodStr && ' · '}
          {periodStr}
          {!periodStr && formatDate(inv.created_at)}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
        <div style={{ fontWeight: 900, color: COLORS.coral, fontSize: '1.1rem' }}>${Number(inv.total).toFixed(2)}</div>
        <div style={{ color: '#ccc', fontSize: '0.8rem' }}>›</div>
      </div>
    </div>
  )
}

export default function Home() {
  const [tab, setTab] = useState('invoices') // invoices | schedule
  const [view, setView] = useState('home') // home | new | detail
  const [invoices, setInvoices] = useState([])
  const [activeInv, setActiveInv] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const loadInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setInvoices(data)
    setLoading(false)
  }

  useEffect(() => { loadInvoices() }, [])

  const nextNum = () => {
    if (invoices.length === 0) return '001'
    const max = Math.max(...invoices.map(i => parseInt(i.invoice_number) || 0))
    return padNum(max + 1)
  }

  const handleSave = async (formData) => {
    let result
    if (activeInv) {
      const { data, error } = await supabase
        .from('invoices')
        .update({ ...formData, updated_at: new Date().toISOString() })
        .eq('id', activeInv.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      result = data
    } else {
      const { data, error } = await supabase
        .from('invoices')
        .insert([{ ...formData, invoice_number: nextNum(), paid: false }])
        .select()
        .single()
      if (error) throw new Error(error.message)
      result = data
    }
    await loadInvoices()
    setActiveInv(result)
    showToast(activeInv ? 'Invoice updated!' : 'Invoice saved!')
    setView('detail')
  }

  const handleTogglePaid = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .update({ paid: !activeInv.paid, updated_at: new Date().toISOString() })
      .eq('id', activeInv.id)
      .select()
      .single()
    if (!error && data) {
      setActiveInv(data)
      await loadInvoices()
    }
  }

  const handleDelete = async () => {
    await supabase.from('invoices').delete().eq('id', activeInv.id)
    await loadInvoices()
    setActiveInv(null)
    setView('home')
    showToast('Invoice deleted')
  }

  // Invoice form
  if (view === 'new') {
    return (
      <>
        <Head><title>{activeInv ? 'Edit Invoice' : 'New Invoice'} — Love 4 Dogs</title></Head>
        <InvoiceForm
          initial={activeInv}
          nextNum={nextNum()}
          onSave={handleSave}
          onCancel={() => setView(activeInv ? 'detail' : 'home')}
        />
      </>
    )
  }

  // Invoice detail
  if (view === 'detail' && activeInv) {
    return (
      <>
        <Head><title>Invoice #{activeInv.invoice_number} — Love 4 Dogs</title></Head>
        <InvoiceDetail
          inv={activeInv}
          onEdit={() => setView('new')}
          onBack={() => { setActiveInv(null); setView('home') }}
          onTogglePaid={handleTogglePaid}
          onDelete={handleDelete}
        />
      </>
    )
  }

  // Home with tabs
  const unpaid = invoices.filter(i => !i.paid)
  const paid = invoices.filter(i => i.paid)
  const totalOwed = unpaid.reduce((a, b) => a + Number(b.total), 0)

  return (
    <>
      <Head>
        <title>Love 4 Dogs</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#5bbce4" />
      </Head>

      <div style={{ background: '#e8f4fd', minHeight: '100vh' }}>
        {toast && <Toast msg={toast} />}

        {/* Header */}
        <div style={{ background: COLORS.blue, padding: '18px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/logo192.png" alt="Love 4 Dogs" style={{ width: 38, height: 38, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.8)' }} />
              <div>
                <div style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 900, lineHeight: 1.1 }}>Love 4 Dogs</div>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.72rem', fontWeight: 600 }}>Millie Ruth &amp; Ayres</div>
              </div>
            </div>
            {tab === 'invoices' && (
              <button onClick={() => { setActiveInv(null); setView('new') }}
                style={{ background: COLORS.coral, color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 18, fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}>
                + Invoice
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {[
              { id: 'invoices', label: '🧾 Invoices' },
              { id: 'schedule', label: '📅 Schedule' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                  background: tab === t.id ? '#fff' : 'transparent',
                  color: tab === t.id ? COLORS.navy : 'rgba(255,255,255,0.85)',
                  fontWeight: 800, fontSize: '0.85rem',
                  borderRadius: tab === t.id ? '12px 12px 0 0' : 0,
                  borderBottom: tab === t.id ? 'none' : '3px solid transparent',
                  transition: 'all 0.2s',
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Invoice tab */}
        {tab === 'invoices' && (
          <div style={{ padding: '14px 16px', maxWidth: 700, margin: '0 auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>Loading...</div>
            ) : invoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🐶</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: COLORS.navy, marginBottom: 8 }}>No invoices yet</div>
                <div style={{ color: '#777', fontSize: '0.9rem', marginBottom: 20 }}>Tap + Invoice to get started</div>
                <button onClick={() => { setActiveInv(null); setView('new') }}
                  style={{ background: COLORS.coral, color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 20, fontSize: '1rem', fontWeight: 800, cursor: 'pointer' }}>
                  + New Invoice
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <StatCard label="Total" value={invoices.length} />
                  <StatCard label="Unpaid" value={unpaid.length} color={COLORS.coral} />
                  <StatCard label="Owed" value={`$${totalOwed.toFixed(2)}`} color={COLORS.darkBlue} />
                </div>

                {unpaid.length > 0 && (
                  <>
                    <SectionLabel>Unpaid</SectionLabel>
                    {unpaid.map(inv => (
                      <InvoiceCard key={inv.id} inv={inv} onClick={() => { setActiveInv(inv); setView('detail') }} />
                    ))}
                  </>
                )}
                {paid.length > 0 && (
                  <>
                    <SectionLabel style={{ marginTop: unpaid.length ? 14 : 0 }}>Paid</SectionLabel>
                    {paid.map(inv => (
                      <InvoiceCard key={inv.id} inv={inv} onClick={() => { setActiveInv(inv); setView('detail') }} />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Schedule tab */}
        {tab === 'schedule' && <Schedule />}
      </div>
    </>
  )
}

function SectionLabel({ children, style }) {
  return (
    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#888', letterSpacing: 1, marginBottom: 8, ...style }}>
      {children}
    </div>
  )
}
