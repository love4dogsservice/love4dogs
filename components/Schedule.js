import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  COLORS, SERVICES, getDaysInMonth, getFirstDayOfMonth,
  toDateKey, todayKey, MONTH_NAMES, DAY_NAMES, formatTime
} from '../lib/helpers'
import Toast from './Toast'

const SERVICE_COLORS = {
  1: '#5bbce4', // Dog Walking - blue
  2: '#e05a3a', // Feeding - coral
  3: '#2d8a5a', // Potty - green
  4: '#9b59b6', // Playtime - purple
}

export default function Schedule() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [jobs, setJobs] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editJob, setEditJob] = useState(null)
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const loadJobs = async () => {
    const { data, error } = await supabase
      .from('schedule')
      .select('*')
      .order('job_date', { ascending: true })
      .order('job_time', { ascending: true })
    if (!error && data) setJobs(data)
    setLoading(false)
  }

  useEffect(() => { loadJobs() }, [])

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const jobsByDate = jobs.reduce((acc, job) => {
    const key = job.job_date
    if (!acc[key]) acc[key] = []
    acc[key].push(job)
    return acc
  }, {})

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const todayStr = todayKey()

  const selectedDateKey = selectedDay
    ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : null

  const selectedJobs = selectedDateKey ? (jobsByDate[selectedDateKey] || []) : []

  const handleDeleteJob = async (id) => {
    await supabase.from('schedule').delete().eq('id', id)
    await loadJobs()
    showToast('Job removed')
  }

  return (
    <div style={{ padding: '14px 16px', maxWidth: 700, margin: '0 auto' }}>
      {toast && <Toast msg={toast} />}

      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={prevMonth} style={{ background: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontWeight: 700, fontSize: '1rem', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>‹</button>
        <div style={{ fontWeight: 900, color: COLORS.navy, fontSize: '1.1rem' }}>{MONTH_NAMES[month]} {year}</div>
        <button onClick={nextMonth} style={{ background: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontWeight: 700, fontSize: '1rem', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>›</button>
      </div>

      {/* Calendar grid */}
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 14 }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: COLORS.lightBlue }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ textAlign: 'center', padding: '8px 2px', fontSize: '0.7rem', fontWeight: 800, color: COLORS.darkBlue, textTransform: 'uppercase' }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {/* Empty cells for first day offset */}
          {Array(firstDay).fill(null).map((_, i) => (
            <div key={`empty-${i}`} style={{ minHeight: 60, borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0' }} />
          ))}

          {Array(daysInMonth).fill(null).map((_, i) => {
            const day = i + 1
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = dateKey === todayStr
            const isSelected = selectedDay === day
            const dayJobs = jobsByDate[dateKey] || []

            return (
              <div key={day} onClick={() => setSelectedDay(isSelected ? null : day)}
                style={{
                  minHeight: 60, padding: '4px', cursor: 'pointer',
                  borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0',
                  background: isSelected ? COLORS.lightBlue : isToday ? '#fffbe6' : '#fff',
                  transition: 'background 0.15s',
                }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', marginBottom: 2,
                  background: isToday ? COLORS.blue : 'transparent',
                  color: isToday ? '#fff' : COLORS.navy,
                  fontWeight: isToday ? 900 : 600, fontSize: '0.82rem',
                }}>{day}</div>
                {dayJobs.slice(0, 3).map((job, ji) => (
                  <div key={ji} style={{
                    background: SERVICE_COLORS[job.service_type] || COLORS.blue,
                    borderRadius: 4, padding: '1px 4px', marginBottom: 1,
                    fontSize: '0.6rem', color: '#fff', fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {job.job_time ? formatTime(job.job_time) + ' ' : ''}{job.client_name}
                  </div>
                ))}
                {dayJobs.length > 3 && (
                  <div style={{ fontSize: '0.58rem', color: '#888', fontWeight: 600 }}>+{dayJobs.length - 3} more</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected day panel */}
      {selectedDay && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 900, color: COLORS.navy, fontSize: '1rem' }}>
              {MONTH_NAMES[month]} {selectedDay}
            </div>
            <button
              onClick={() => { setEditJob(null); setShowForm(true) }}
              style={{ background: COLORS.coral, color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 16, fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer' }}>
              + Add Job
            </button>
          </div>

          {selectedJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#aaa', fontSize: '0.85rem' }}>
              No jobs scheduled — tap + Add Job
            </div>
          ) : (
            selectedJobs.map(job => (
              <div key={job.id} style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                padding: '10px 12px', marginBottom: 8, borderRadius: 10,
                borderLeft: `4px solid ${SERVICE_COLORS[job.service_type] || COLORS.blue}`,
                background: '#f8fbfe',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: COLORS.navy, fontSize: '0.9rem' }}>{job.client_name}</div>
                  {job.dog_name && <div style={{ color: '#666', fontSize: '0.78rem' }}>🐾 {job.dog_name}</div>}
                  <div style={{ color: '#888', fontSize: '0.75rem', marginTop: 2 }}>
                    {SERVICES[job.service_type]?.name}
                    {job.job_time && ` · ${formatTime(job.job_time)}`}
                  </div>
                  {job.notes && <div style={{ color: '#999', fontSize: '0.72rem', marginTop: 2 }}>{job.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setEditJob(job); setShowForm(true) }}
                    style={{ background: COLORS.lightBlue, border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, color: COLORS.darkBlue, cursor: 'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDeleteJob(job.id)}
                    style={{ background: COLORS.lightRed, border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, color: COLORS.coral, cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add/Edit job modal */}
      {showForm && (
        <JobForm
          initial={editJob}
          defaultDate={selectedDateKey}
          onSave={async () => { await loadJobs(); setShowForm(false); setEditJob(null); showToast('Job saved!') }}
          onCancel={() => { setShowForm(false); setEditJob(null) }}
        />
      )}
    </div>
  )
}

function JobForm({ initial, defaultDate, onSave, onCancel }) {
  const [clientName, setClientName] = useState(initial?.client_name || '')
  const [dogName, setDogName] = useState(initial?.dog_name || '')
  const [date, setDate] = useState(initial?.job_date || defaultDate || '')
  const [time, setTime] = useState(initial?.job_time || '')
  const [svcType, setSvcType] = useState(initial?.service_type || 1)
  const [notes, setNotes] = useState(initial?.notes || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!clientName.trim() || !date) return
    setSaving(true)

    const payload = {
      client_name: clientName.trim(),
      dog_name: dogName.trim(),
      job_date: date,
      job_time: time || null,
      service_type: svcType,
      notes: notes.trim(),
    }

    if (initial) {
      await supabase.from('schedule').update(payload).eq('id', initial.id)
    } else {
      await supabase.from('schedule').insert([payload])
    }

    // Schedule notification if time is set
    if (time && 'Notification' in window && Notification.permission === 'granted') {
      const jobDateTime = new Date(`${date}T${time}`)
      const notifyTime = new Date(jobDateTime.getTime() - 30 * 60 * 1000) // 30 min before
      const now = new Date()
      if (notifyTime > now) {
        const delay = notifyTime.getTime() - now.getTime()
        setTimeout(() => {
          new Notification('🐾 Love 4 Dogs — Job Reminder', {
            body: `${clientName}${dogName ? ` (${dogName})` : ''} · ${SERVICES[svcType]?.name} in 30 minutes`,
            icon: '/logo192.png',
          })
        }, delay)
      }
    }

    setSaving(false)
    await onSave()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', zIndex: 200,
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 20px 32px',
        width: '100%', maxWidth: 700, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontWeight: 900, color: COLORS.navy, fontSize: '1rem' }}>
            {initial ? 'Edit Job' : 'Add Job'}
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: '1.4rem', color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <JobField label="Client Name *" value={clientName} onChange={setClientName} />
          <JobField label="Dog's Name" value={dogName} onChange={setDogName} />
          <JobField label="Date *" value={date} onChange={setDate} type="date" />
          <JobField label="Time" value={time} onChange={setTime} type="time" />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.68rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Service</div>
          <select value={svcType} onChange={e => setSvcType(parseInt(e.target.value))}
            style={{ width: '100%', border: 'none', borderBottom: '2px solid #ccd', fontSize: '0.9rem', padding: '4px 2px', outline: 'none', color: '#111', background: 'transparent', fontWeight: 600 }}>
            {SERVICES.slice(1).map((s, i) => <option key={i} value={i + 1}>{s.name}</option>)}
          </select>
        </div>

        <JobField label="Notes" value={notes} onChange={setNotes} placeholder="Any special instructions..." />

        <button onClick={handleSave} disabled={saving || !clientName.trim() || !date}
          style={{
            width: '100%', marginTop: 16, background: saving || !clientName.trim() || !date ? '#ccc' : COLORS.coral,
            color: '#fff', border: 'none', padding: '14px', borderRadius: 14, fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
          }}>
          {saving ? 'Saving...' : initial ? 'Update Job' : 'Add Job'}
        </button>
      </div>
    </div>
  )
}

function JobField({ label, value, onChange, placeholder, type }) {
  return (
    <div>
      <div style={{ fontSize: '0.68rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
      <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || ''}
        style={{ width: '100%', border: 'none', borderBottom: '2px solid #ccd', fontSize: '0.9rem', padding: '4px 2px', outline: 'none', color: '#111', background: 'transparent', fontWeight: 600 }} />
    </div>
  )
}
