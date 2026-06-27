import { useState, useEffect } from 'react'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import { COLORS, formatDate, formatDateShort, padNum } from '../lib/helpers'
import Clients from '../components/Clients'
import Schedule from '../components/Schedule'
import InvoiceBuilder from '../components/InvoiceBuilder'
import InvoiceDetail from '../components/InvoiceDetail'
import InvoiceForm from '../components/InvoiceForm'
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
  const periodStr = inv.period_start
    ? `${formatDateShort(inv.period_start)}${inv.period_end ? ' – ' + formatDateShort(inv.period_end) : ''}`
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
          <span style={{ background: inv.paid ? COLORS.lightGreen : COLORS.lightRed, color: inv.paid ? COLORS.green : COLORS.coral, fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase' }}>
            {inv.paid ? 'Paid' : 'Unpaid'}
          </span>
        </div>
        <div style={{ fontWeight: 700, color: '#333', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.client_name}</div>
        <div style={{ color: '#888', fontSize: '0.75rem', marginTop: 2 }}>
          {inv.dog_names && `🐾 ${inv.dog_names}`}
          {inv.dog_names && periodStr && ' · '}
          {periodStr || formatDate(inv.created_at)}
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
  const [tab, setTab] = useState('invoices')
  const [view, setView] = useState('home') // home | builder | manual | detail
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [dogs, setDogs] = useState([])
  const [activeInv, setActiveInv] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const loadAll = async () => {
    const [invRes, clientRes, dogRes] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('dogs').select('*').order('name'),
    ])
    if (invRes.data) setInvoices(invRes.data)
    if (clientRes.data) setClients(clientRes.data)
    if (dogRes.data) setDogs(dogRes.data)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const handleTogglePaid = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .update({ paid: !activeInv.paid, updated_at: new Date().toISOString() })
      .eq('id', activeInv.id)
      .select()
      .single()
    if (error) { console.error('togglePaid error:', error); return }
    if (data) {
      await loadAll()
      setActiveInv(data)
      showToast(data.paid ? 'Marked as paid!' : 'Marked as unpaid')
    }
  }

  const handleDelete = async () => {
    const { error } = await supabase.from('invoices').delete().eq('id', activeInv.id)
    if (error) { console.error('delete error:', error); return }
    setActiveInv(null)
    setView('home')
    await loadAll()
    showToast('Invoice deleted')
  }

  const handleManualSave = async (formData) => {
    const payload = activeInv ? { id: activeInv.id, ...formData } : formData
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok || json.error) throw new Error(json.error || 'Save failed')
    await loadAll()
    setActiveInv(json.data)
    showToast(activeInv ? 'Invoice updated!' : 'Invoice saved!')
    setView('detail')
  }

  // ── Invoice builder (From Schedule) ──
  if (view === 'builder') {
    return (
      <>
        <Head><title>New Invoice — Love 4 Dogs</title></Head>
        <InvoiceBuilder
          clients={clients}
          dogs={dogs}
          onSaved={async (inv) => { await loadAll(); setActiveInv(inv); setView('detail'); showToast('Invoice saved!') }}
          onCancel={() => setView('home')}
        />
      </>
    )
  }

  // ── Manual invoice ──
  if (view === 'manual') {
    return (
      <>
        <Head><title>{activeInv ? 'Edit Invoice' : 'Manual Invoice'} — Love 4 Dogs</title></Head>
        <InvoiceForm
          initial={activeInv}
          clients={clients}
          dogs={dogs}
          onSave={handleManualSave}
          onCancel={() => setView(activeInv ? 'detail' : 'home')}
        />
      </>
    )
  }

  // ── Invoice detail ──
  if (view === 'detail' && activeInv) {
    return (
      <>
        <Head><title>Invoice #{activeInv.invoice_number} — Love 4 Dogs</title></Head>
        <InvoiceDetail
          inv={activeInv}
          onEdit={() => setView('manual')}
          onBack={() => { setActiveInv(null); setView('home') }}
          onTogglePaid={handleTogglePaid}
          onDelete={handleDelete}
        />
      </>
    )
  }

  // ── Home ──
  const unpaid = invoices.filter(i => !i.paid)
  const paid = invoices.filter(i => i.paid)
  const totalOwed = unpaid.reduce((a, b) => a + Number(b.total), 0)

  const TABS = [
    { id: 'invoices', icon: '🧾', label: 'Invoices' },
    { id: 'schedule', icon: '📅', label: 'Schedule' },
    { id: 'clients', icon: '👤', label: 'Clients' },
  ]

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
        <div style={{ background: COLORS.blue, padding: '16px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/logo192.png" alt="Love 4 Dogs" style={{ width: 38, height: 38, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.8)' }} />
              <div>
                <div style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 900, lineHeight: 1.1 }}>Love 4 Dogs</div>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.72rem', fontWeight: 600 }}>Millie Ruth &amp; Ayres</div>
              </div>
            </div>

            {tab === 'invoices' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setActiveInv(null); setView('builder') }}
                  style={{ background: '#fff', color: COLORS.darkBlue, border: 'none', padding: '8px 12px', borderRadius: 16, fontSize: '0.78rem', fontWeight: 800 }}>
                  From Schedule
                </button>
                <button onClick={() => { setActiveInv(null); setView('manual') }}
                  style={{ background: COLORS.coral, color: '#fff', border: 'none', padding: '8px 12px', borderRadius: 16, fontSize: '0.78rem', fontWeight: 800 }}>
                  + Manual
                </button>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{
                  flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                  background: tab === t.id ? '#fff' : 'transparent',
                  color: tab === t.id ? COLORS.navy : 'rgba(255,255,255,0.85)',
                  fontWeight: 800, fontSize: '0.82rem',
                  borderRadius: tab === t.id ? '12px 12px 0 0' : 0,
                }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Invoices tab */}
        {tab === 'invoices' && (
          <div style={{ padding: '14px 16px', maxWidth: 700, margin: '0 auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#888' }}>Loading...</div>
            ) : invoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>🧾</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: COLORS.navy, marginBottom: 8 }}>No invoices yet</div>
                <div style={{ color: '#777', fontSize: '0.9rem', marginBottom: 20 }}>Create your first invoice to get started</div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => { setActiveInv(null); setView('builder') }}
                    style={{ background: COLORS.blue, color: '#fff', border: 'none', padding: '12px 20px', borderRadius: 20, fontSize: '0.9rem', fontWeight: 800 }}>
                    From Schedule
                  </button>
                  <button onClick={() => { setActiveInv(null); setView('manual') }}
                    style={{ background: COLORS.coral, color: '#fff', border: 'none', padding: '12px 20px', borderRadius: 20, fontSize: '0.9rem', fontWeight: 800 }}>
                    Manual Invoice
                  </button>
                </div>
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
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#888', letterSpacing: 1, marginBottom: 8 }}>Unpaid</div>
                    {unpaid.map(inv => <InvoiceCard key={inv.id} inv={inv} onClick={() => { setActiveInv(inv); setView('detail') }} />)}
                  </>
                )}
                {paid.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#888', letterSpacing: 1, marginBottom: 8, marginTop: unpaid.length ? 14 : 0 }}>Paid</div>
                    {paid.map(inv => <InvoiceCard key={inv.id} inv={inv} onClick={() => { setActiveInv(inv); setView('detail') }} />)}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'schedule' && <Schedule clients={clients} dogs={dogs} />}
        {tab === 'clients' && <Clients clients={clients} dogs={dogs} onRefresh={loadAll} />}
      </div>
    </>
  )
}
