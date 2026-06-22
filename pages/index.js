import { useState, useEffect } from 'react'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import { COLORS, formatDate, padInvoiceNum } from '../lib/helpers'
import InvoiceForm from '../components/InvoiceForm'
import InvoiceDetail from '../components/InvoiceDetail'
import Toast from '../components/Toast'

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '12px 14px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center',
    }}>
      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: color || COLORS.navy }}>{value}</div>
      <div style={{ fontSize: '0.65rem', color: '#888', fontWeight: 700, textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function InvoiceCard({ inv, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', borderRadius: 14, padding: '14px 16px',
        marginBottom: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderLeft: `4px solid ${inv.paid ? COLORS.blue : COLORS.coral}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 900, color: COLORS.navy, fontSize: '0.95rem' }}>#{inv.invoice_number}</span>
          <span style={{
            background: inv.paid ? COLORS.lightGreen : COLORS.lightRed,
            color: inv.paid ? COLORS.green : COLORS.coral,
            fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px',
            borderRadius: 10, textTransform: 'uppercase', flexShrink: 0,
          }}>
            {inv.paid ? 'Paid' : 'Unpaid'}
          </span>
        </div>
        <div style={{ fontWeight: 700, color: '#333', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {inv.client_name}
        </div>
        <div style={{ color: '#888', fontSize: '0.75rem', marginTop: 2 }}>
          {inv.dog_name && `🐾 ${inv.dog_name} · `}{formatDate(inv.created_at)}
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
    return padInvoiceNum(max + 1)
  }

  const handleSave = async (formData) => {
    if (activeInv) {
      // Update
      const { data, error } = await supabase
        .from('invoices')
        .update({ ...formData, updated_at: new Date().toISOString() })
        .eq('id', activeInv.id)
        .select()
        .single()
      if (!error && data) {
        setActiveInv(data)
        await loadInvoices()
        showToast('Invoice updated!')
        setView('detail')
      } else {
        throw new Error(error?.message)
      }
    } else {
      // Insert
      const { data, error } = await supabase
        .from('invoices')
        .insert([{ ...formData, invoice_number: nextNum(), paid: false }])
        .select()
        .single()
      if (!error && data) {
        setActiveInv(data)
        await loadInvoices()
        showToast('Invoice saved!')
        setView('detail')
      } else {
        throw new Error(error?.message)
      }
    }
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

  if (view === 'new') {
    return (
      <>
        <Head><title>New Invoice — Love 4 Dogs</title></Head>
        <InvoiceForm
          initial={activeInv}
          nextNum={nextNum()}
          onSave={handleSave}
          onCancel={() => setView(activeInv ? 'detail' : 'home')}
        />
      </>
    )
  }

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

  // HOME
  const unpaid = invoices.filter(i => !i.paid)
  const paid = invoices.filter(i => i.paid)
  const totalOwed = unpaid.reduce((a, b) => a + Number(b.total), 0)

  return (
    <>
      <Head>
        <title>Love 4 Dogs — Business Tool</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#5bbce4" />
      </Head>

      <div style={{ fontFamily: 'inherit', background: '#e8f4fd', minHeight: '100vh' }}>
        {toast && <Toast msg={toast} />}

        {/* Header */}
        <div style={{
          background: COLORS.blue, padding: '18px 20px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 900 }}>🐾 Love 4 Dogs</div>
            <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.78rem', fontWeight: 600 }}>Millie Ruth &amp; Ayres</div>
          </div>
          <button
            onClick={() => { setActiveInv(null); setView('new') }}
            style={{
              background: COLORS.coral, color: '#fff', border: 'none',
              padding: '10px 20px', borderRadius: 20, fontSize: '0.9rem',
              fontWeight: 800, cursor: 'pointer',
            }}
          >
            + New Invoice
          </button>
        </div>

        <div style={{ padding: '14px 16px', maxWidth: 700, margin: '0 auto' }}>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>Loading...</div>
          ) : invoices.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🐶</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: COLORS.navy, marginBottom: 8 }}>No invoices yet</div>
              <div style={{ color: '#777', fontSize: '0.9rem', marginBottom: 20 }}>Tap + New Invoice to get started</div>
              <button
                onClick={() => { setActiveInv(null); setView('new') }}
                style={{ background: COLORS.coral, color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 20, fontSize: '1rem', fontWeight: 800, cursor: 'pointer' }}
              >
                + New Invoice
              </button>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                <StatCard label="Total" value={invoices.length} />
                <StatCard label="Unpaid" value={unpaid.length} color={COLORS.coral} />
                <StatCard label="Owed" value={`$${totalOwed.toFixed(2)}`} color={COLORS.darkBlue} />
              </div>

              {unpaid.length > 0 && (
                <>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#888', letterSpacing: 1, marginBottom: 8 }}>
                    Unpaid
                  </div>
                  {unpaid.map(inv => (
                    <InvoiceCard key={inv.id} inv={inv} onClick={() => { setActiveInv(inv); setView('detail') }} />
                  ))}
                </>
              )}

              {paid.length > 0 && (
                <>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#888', letterSpacing: 1, marginBottom: 8, marginTop: unpaid.length ? 14 : 0 }}>
                    Paid
                  </div>
                  {paid.map(inv => (
                    <InvoiceCard key={inv.id} inv={inv} onClick={() => { setActiveInv(inv); setView('detail') }} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
