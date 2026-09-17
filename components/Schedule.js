import { useState, useEffect } from 'react'
import {
  COLORS, SERVICES, SERVICE_COLORS, getDaysInMonth, getFirstDayOfMonth,
  dateToKey, todayISO, MONTH_NAMES, DAY_NAMES, formatTime, parseVoiceJob
} from '../lib/helpers'
import Toast from './Toast'

// Shared by the calendar's day-name header row and its date grid so the two
// grids can never end up with different column widths.
const CALENDAR_COLS = 'repeat(7, minmax(44px, 1fr))'

const pad2 = (n) => String(n).padStart(2, '0')

// Escape TEXT-type ICS property values per RFC 5545 — matters here since
// multi-dog job names are comma-separated ("Buddy, Max").
const icsEscape = (text) => String(text || '').replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n')

function buildVeventBlock(job) {
  const svc = SERVICES[job.service_type]?.name || 'Job'
  const [y, m, d] = job.job_date.split('-').map(Number)

  let dtStartLine, dtEndLine
  if (job.job_time) {
    const [h, min] = job.job_time.split(':').map(Number)
    const start = new Date(y, m - 1, d, h, min)
    const end = new Date(start.getTime() + 60 * 60 * 1000) // DTEND = one hour after DTSTART
    const fmt = (dt) => `${dt.getFullYear()}${pad2(dt.getMonth() + 1)}${pad2(dt.getDate())}T${pad2(dt.getHours())}${pad2(dt.getMinutes())}00`
    dtStartLine = `DTSTART:${fmt(start)}`
    dtEndLine = `DTEND:${fmt(end)}`
  } else {
    // No time set — all-day event. Per RFC 5545, DTEND for an all-day event
    // is exclusive, so it's set to the following day.
    const startStr = `${y}${pad2(m)}${pad2(d)}`
    const endDate = new Date(y, m - 1, d + 1)
    const endStr = `${endDate.getFullYear()}${pad2(endDate.getMonth() + 1)}${pad2(endDate.getDate())}`
    dtStartLine = `DTSTART;VALUE=DATE:${startStr}`
    dtEndLine = `DTEND;VALUE=DATE:${endStr}`
  }

  const summary = icsEscape(`${svc} - ${job.client_name || ''}`)
  const description = icsEscape([
    job.dog_name ? `Dog: ${job.dog_name}` : '',
    `Service: ${svc}`,
    'Love 4 Dogs - 601-946-3924',
  ].filter(Boolean).join('\n'))
  const uid = `love4dogs-${job.id || Date.now()}-${Math.random().toString(36).slice(2)}@love4dogs`

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    dtStartLine,
    dtEndLine,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
    'END:VEVENT',
  ].join('\r\n')
}

// Accepts an array of jobs and returns one .ics string containing one
// VEVENT block per job, so iOS imports them all from a single file.
function generateICS(jobs) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Love4Dogs//EN',
    ...jobs.map(buildVeventBlock),
    'END:VCALENDAR',
  ].join('\r\n')
}

function downloadIcsFile(icsContent, filename) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function downloadJobIcs(job) {
  downloadIcsFile(generateICS([job]), 'love4dogs-job.ics')
}

function downloadJobsIcs(jobs) {
  downloadIcsFile(generateICS(jobs), `love4dogs-jobs-${jobs.length}.ics`)
}

export default function Schedule({ clients, dogs }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [jobs, setJobs] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editJob, setEditJob] = useState(null)
  const [panel, setPanel] = useState(null) // null | 'voice' | 'paste' | 'template'
  const [toast, setToast] = useState(null)
  const [postSavePrompt, setPostSavePrompt] = useState(null) // array of just-saved jobs, or null

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const loadJobs = async () => {
    const res = await fetch('/api/schedule')
    if (res.ok) {
      const data = await res.json()
      setJobs(data)
    }
  }

  useEffect(() => { loadJobs() }, [])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const clientsWithDogs = (clients || []).map(c => ({ ...c, dogs: (dogs || []).filter(d => d.client_id === c.id) }))

  const jobsByDate = jobs.reduce((acc, job) => {
    if (!acc[job.job_date]) acc[job.job_date] = []
    acc[job.job_date].push(job)
    return acc
  }, {})

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const todayStr = todayISO()

  const selectedDateKey = selectedDay ? dateToKey(year, month, selectedDay) : null
  const selectedJobs = selectedDateKey ? (jobsByDate[selectedDateKey] || []) : []

  const handleDeleteJob = async (id) => {
    await fetch(`/api/schedule?id=${id}`, { method: 'DELETE' })
    loadJobs()
    showToast('Job removed')
  }

  const parseAndOpen = (text) => {
    const parsed = parseVoiceJob(text, clientsWithDogs)
    setEditJob({
      client_id: parsed.client_id || null,
      client_name: parsed.client_name || '',
      dog_id: parsed.dog_id || null,
      dog_name: parsed.dog_name || '',
      job_date: parsed.job_date || '',
      job_time: parsed.job_time || '',
      service_type: parsed.service_idx || 1,
      notes: parsed.notes || '',
    })
    setPanel(null)
    setShowForm(true)
  }

  return (
    <div style={{ padding: '14px 16px', maxWidth: 700, margin: '0 auto' }}>
      {toast && <Toast msg={toast} />}

      {postSavePrompt && (
        <AddToCalendarPrompt jobs={postSavePrompt} onDismiss={() => setPostSavePrompt(null)} />
      )}

      {/* Quick action panels */}
      {panel === 'voice' ? (
        <VoicePanel
          onSubmitText={parseAndOpen}
          onCancel={() => setPanel(null)}
        />
      ) : panel === 'paste' ? (
        <PasteTextPanel
          clients={clientsWithDogs}
          onSaved={async () => { await loadJobs(); setPanel(null); showToast('Jobs added!') }}
          onCancel={() => setPanel(null)}
        />
      ) : panel === 'template' ? (
        <ApplyTemplatePanel
          clients={clientsWithDogs}
          onSaved={async () => { await loadJobs(); setPanel(null); showToast('Jobs added!') }}
          onCancel={() => setPanel(null)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPanel('voice')}
              style={{ flex: 1, background: COLORS.blue, color: '#fff', border: 'none', padding: '11px', borderRadius: 14, fontWeight: 800, fontSize: '0.9rem' }}>
              ⚡ Quick Add
            </button>
            <button onClick={() => { setEditJob(null); setShowForm(true) }}
              style={{ flex: 1, background: COLORS.coral, color: '#fff', border: 'none', padding: '11px', borderRadius: 14, fontWeight: 800, fontSize: '0.9rem' }}>
              + Manual Add
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPanel('paste')}
              style={{ flex: 1, background: '#fff', color: COLORS.darkBlue, border: `2px solid ${COLORS.blue}`, padding: '9px', borderRadius: 14, fontWeight: 800, fontSize: '0.82rem' }}>
              📋 Paste Client Text
            </button>
            <button onClick={() => setPanel('template')}
              style={{ flex: 1, background: '#fff', color: COLORS.darkBlue, border: `2px solid ${COLORS.blue}`, padding: '9px', borderRadius: 14, fontWeight: 800, fontSize: '0.82rem' }}>
              🗓️ Apply Template
            </button>
          </div>
        </div>
      )}

      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y-1) } else setMonth(m => m-1); setSelectedDay(null) }}
          style={{ background: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontWeight: 700, fontSize: '1rem', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>‹</button>
        <div style={{ fontWeight: 900, color: COLORS.navy, fontSize: '1.1rem' }}>{MONTH_NAMES[month]} {year}</div>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y+1) } else setMonth(m => m+1); setSelectedDay(null) }}
          style={{ background: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontWeight: 700, fontSize: '1rem', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>›</button>
      </div>

      {/* Calendar — header and date grid share one column definition (CALENDAR_COLS)
          with a 44px floor per column so they can never drift out of alignment or
          get squeezed unreadably small on narrow phones. */}
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 14, overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: CALENDAR_COLS, background: COLORS.lightBlue }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ textAlign: 'center', padding: '8px 2px', fontSize: '0.7rem', fontWeight: 800, color: COLORS.darkBlue, textTransform: 'uppercase' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: CALENDAR_COLS }}>
          {Array(firstDay).fill(null).map((_, i) => (
            <div key={`e${i}`} style={{ minHeight: 50, borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0' }} />
          ))}
          {Array(daysInMonth).fill(null).map((_, i) => {
            const day = i + 1
            const dk = dateToKey(year, month, day)
            const isToday = dk === todayStr
            const isSelected = selectedDay === day
            const dayJobs = jobsByDate[dk] || []
            return (
              <div key={day} onClick={() => setSelectedDay(isSelected ? null : day)}
                style={{
                  minHeight: 50, padding: '3px', cursor: 'pointer',
                  borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0',
                  background: isSelected ? COLORS.lightBlue : isToday ? '#fffbe6' : '#fff',
                }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2,
                  background: isToday ? COLORS.blue : 'transparent',
                  color: isToday ? '#fff' : COLORS.navy, fontWeight: isToday ? 900 : 600, fontSize: '0.82rem',
                }}>{day}</div>
                {dayJobs.slice(0, 2).map((job, ji) => (
                  <div key={ji} style={{
                    background: SERVICE_COLORS[job.service_type] || COLORS.blue,
                    borderRadius: 3, padding: '1px 3px', marginBottom: 1,
                    fontSize: '0.62rem', color: '#fff', fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {job.job_time ? formatTime(job.job_time).replace(' AM','a').replace(' PM','p') + ' ' : ''}{job.dog_name || job.client_name}
                  </div>
                ))}
                {dayJobs.length > 2 && <div style={{ fontSize: '0.62rem', color: '#888', fontWeight: 600 }}>+{dayJobs.length - 2}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected day */}
      {selectedDay && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 900, color: COLORS.navy }}>{MONTH_NAMES[month]} {selectedDay}</div>
            <button onClick={() => { setEditJob(null); setShowForm(true) }}
              style={{ background: COLORS.coral, color: '#fff', border: 'none', padding: '7px 14px', borderRadius: 14, fontSize: '0.8rem', fontWeight: 800 }}>
              + Add Job
            </button>
          </div>
          {selectedJobs.length > 1 && (
            <button onClick={() => downloadJobsIcs(selectedJobs)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                width: '100%', marginBottom: 10, background: '#f0f4ff', border: 'none',
                borderRadius: 10, padding: '9px', fontSize: '0.82rem', fontWeight: 800,
                color: '#3a5bbf', cursor: 'pointer',
              }}>
              📅 Add All {selectedJobs.length} to Calendar
            </button>
          )}
          {selectedJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px', color: '#aaa', fontSize: '0.85rem' }}>No jobs — tap + Add Job</div>
          ) : selectedJobs.map(job => (
            <div key={job.id} style={{
              padding: '10px 12px', marginBottom: 8, borderRadius: 10,
              borderLeft: `4px solid ${SERVICE_COLORS[job.service_type] || COLORS.blue}`,
              background: job.invoiced ? '#f5f5f5' : '#f8fbfe',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: COLORS.navy, fontSize: '0.9rem' }}>
                    {job.client_name}
                    {job.invoiced && <span style={{ marginLeft: 6, fontSize: '0.65rem', background: COLORS.lightGreen, color: COLORS.green, padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>Invoiced</span>}
                  </div>
                  {job.dog_name && <div style={{ color: '#666', fontSize: '0.78rem' }}>🐾 {job.dog_name}</div>}
                  <div style={{ color: '#888', fontSize: '0.75rem', marginTop: 2 }}>
                    {SERVICES[job.service_type]?.name}{job.job_time && ` · ${formatTime(job.job_time)}`}
                  </div>
                  {job.notes && <div style={{ color: '#999', fontSize: '0.72rem', marginTop: 2 }}>{job.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setEditJob(job); setShowForm(true) }}
                    style={{ background: COLORS.lightBlue, border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: '0.72rem', fontWeight: 700, color: COLORS.darkBlue }}>Edit</button>
                  <button onClick={() => handleDeleteJob(job.id)}
                    style={{ background: COLORS.lightRed, border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: '0.72rem', fontWeight: 700, color: COLORS.coral }}>✕</button>
                </div>
              </div>
              {/* Action row */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  onClick={() => downloadJobIcs(job)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: '#f0f4ff', border: 'none', borderRadius: 8,
                    padding: '5px 10px', fontSize: '0.72rem', fontWeight: 700,
                    color: '#3a5bbf', cursor: 'pointer',
                  }}>
                  📅 Add to Calendar
                </button>
                <button onClick={() => {
                  const svc = SERVICES[job.service_type]?.name || 'Job'
                  const timeStr = job.job_time ? formatTime(job.job_time) : ''
                  const dogPart = job.dog_name ? ` (${job.dog_name})` : ''
                  const body = `Hi Mom! Reminder: ${svc} for ${job.client_name}${dogPart}${timeStr ? ` today at ${timeStr}` : ' today'}. - Millie Ruth and Ayres 🐾`
                  window.location.href = `sms:6019463924?body=${encodeURIComponent(body)}`
                }} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: '#f0fff4', border: 'none', borderRadius: 8,
                  padding: '5px 10px', fontSize: '0.72rem', fontWeight: 700,
                  color: '#2d8a5a', cursor: 'pointer',
                }}>
                  💬 Text Mom
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <JobForm
          initial={editJob}
          defaultDate={selectedDateKey}
          clients={clientsWithDogs}
          onSave={async (savedJobs) => {
            await loadJobs()
            setShowForm(false)
            setEditJob(null)
            if (savedJobs && savedJobs.length > 0) {
              setPostSavePrompt(savedJobs)
            } else {
              showToast('Job saved!')
            }
          }}
          onCancel={() => { setShowForm(false); setEditJob(null) }}
        />
      )}
    </div>
  )
}

function AddToCalendarPrompt({ jobs, onDismiss }) {
  const count = jobs.length
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.1)', border: `2px solid ${COLORS.blue}` }}>
      <div style={{ fontWeight: 800, color: COLORS.navy, fontSize: '0.9rem', marginBottom: 10 }}>
        {count > 1 ? `🎉 ${count} jobs created! Add all to iPhone Calendar?` : '✓ Job saved! Add to iPhone Calendar?'}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onDismiss}
          style={{ flex: 1, padding: '10px', background: '#f5f5f5', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem' }}>
          No thanks
        </button>
        <button onClick={() => { downloadJobsIcs(jobs); onDismiss() }}
          style={{ flex: 2, padding: '10px', background: COLORS.coral, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.85rem' }}>
          📅 Add to Calendar
        </button>
      </div>
    </div>
  )
}

function VoicePanel({ onSubmitText, onCancel }) {
  const [typed, setTyped] = useState('')
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '20px', marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight: 900, color: COLORS.navy, fontSize: '1rem', marginBottom: 4 }}>Quick Add Job</div>
      <div style={{ color: '#888', fontSize: '0.82rem', marginBottom: 14 }}>
        Use your device mic or type what you'd say:<br />
        <em style={{ fontSize: '0.78rem' }}>"Walk Buddy on Tuesday at 3pm"</em>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={typed}
          onChange={e => setTyped(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && typed.trim()) onSubmitText(typed.trim()) }}
          placeholder='e.g. Walk Buddy tomorrow at 2pm'
          style={{ flex: 1, border: '1.5px solid #dde', borderRadius: 10, padding: '10px 12px', fontSize: '0.88rem', outline: 'none' }}
        />
        <button
          onClick={() => { if (typed.trim()) onSubmitText(typed.trim()) }}
          disabled={!typed.trim()}
          style={{ padding: '10px 16px', background: typed.trim() ? COLORS.coral : '#ccc', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.88rem' }}>
          Go
        </button>
      </div>

      <button onClick={onCancel}
        style={{ padding: '9px 22px', background: '#f5f5f5', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '0.85rem' }}>
        Cancel
      </button>
    </div>
  )
}

function JobField({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: '0.68rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  )
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildOccurrences(startDate, endDate, selectedDays) {
  const dates = []
  const end = new Date(endDate + 'T00:00:00')
  const cur = new Date(startDate + 'T00:00:00')
  while (cur <= end) {
    if (selectedDays.includes(cur.getDay())) {
      dates.push(cur.toISOString().split('T')[0])
    }
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function initialDogIds(initial, clients) {
  if (!initial) return []
  const c = clients.find(c => c.id === initial.client_id)
  const dogs = c?.dogs || []
  if (initial.dog_name) {
    const names = initial.dog_name.split(',').map(n => n.trim().toLowerCase()).filter(Boolean)
    const matched = dogs.filter(d => names.includes(d.name.toLowerCase())).map(d => d.id)
    if (matched.length > 0) return matched
  }
  return initial.dog_id ? [initial.dog_id] : []
}

function JobForm({ initial, defaultDate, clients, onSave, onCancel }) {
  const [clientId, setClientId] = useState(initial?.client_id || '')
  const [dogIds, setDogIds] = useState(() => initialDogIds(initial, clients))
  const [clientName, setClientName] = useState(initial?.client_name || '')
  const [dogName, setDogName] = useState(initial?.dog_name || '')
  const [date, setDate] = useState(initial?.job_date || defaultDate || '')
  const [time, setTime] = useState(initial?.job_time || '')
  const [svcType, setSvcType] = useState(initial?.service_type || 1)
  const [duration, setDuration] = useState(initial?.duration ?? (initial?.service_type === 2 || initial?.service_type === 3 ? 1 : 15))
  const [notes, setNotes] = useState(initial?.notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Recurring state
  const [recurring, setRecurring] = useState(false)
  const [recurDays, setRecurDays] = useState([])
  const [recurEnd, setRecurEnd] = useState('')

  const selectedClient = clients.find(c => c.id === clientId)
  const clientDogs = selectedClient?.dogs || []

  const handleClientChange = (id) => {
    setClientId(id)
    setDogName('')
    const c = clients.find(c => c.id === id)
    setClientName(c ? c.name : '')
    // Default to ALL of this client's dogs checked — most visits include everyone
    setDogIds(c?.dogs?.map(d => d.id) || [])
  }

  const toggleDog = (id) => {
    setDogIds(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id])
  }

  const toggleRecurDay = (dow) => {
    setRecurDays(prev => prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow])
  }

  const occurrences = recurring && date && recurEnd && recurDays.length > 0
    ? buildOccurrences(date, recurEnd, recurDays)
    : []

  const handleSave = async () => {
    if (!clientName.trim() || !date) return
    setSaving(true)
    setError(null)

    // One service fee covers all selected dogs — store their names comma-separated
    // on a single row, rather than one row (and one fee) per dog.
    const selectedDogs = clientDogs.length > 0
      ? clientDogs.filter(d => dogIds.includes(d.id))
      : (dogName.trim() ? [{ id: null, name: dogName.trim() }] : [])
    const combinedDogName = selectedDogs.map(d => d.name).join(', ')
    const singleDogId = selectedDogs.length === 1 ? selectedDogs[0].id : null

    const base = {
      client_id: clientId && clientId !== '__manual__' ? clientId : null, client_name: clientName.trim(),
      dog_id: singleDogId, dog_name: combinedDogName,
      job_time: time || null,
      service_type: svcType, duration: duration || null, notes: notes.trim(), invoiced: false,
    }

    let savedJobs = []
    let ok = false
    if (initial?.id) {
      const res = await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: initial.id, ...base, job_date: date }),
      })
      ok = res.ok
      if (ok) savedJobs = [await res.json()]
    } else {
      const dates = recurring && occurrences.length > 0 ? occurrences : [date]
      const rows = dates.map(d => ({ ...base, job_date: d }))
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      })
      ok = res.ok
      if (ok) {
        const data = await res.json()
        savedJobs = Array.isArray(data) ? data : (data ? [data] : [])
      }
    }

    if (!ok) {
      setSaving(false)
      setError('Could not save — check your connection and try again')
      return
    }

    if (!recurring && time && 'Notification' in window && Notification.permission === 'granted') {
      const dt = new Date(`${date}T${time}`)
      const notify = new Date(dt.getTime() - 30 * 60 * 1000)
      const delay = notify.getTime() - Date.now()
      if (delay > 0) {
        setTimeout(() => {
          new Notification('🐾 Love 4 Dogs — Job in 30 min', {
            body: `${clientName}${dogName ? ` · ${dogName}` : ''} · ${SERVICES[svcType]?.name}`,
            icon: '/logo192.png',
          })
        }, delay)
      }
    }

    setSaving(false)
    await onSave(savedJobs)
  }

  const canSave = clientName.trim() && (
    recurring ? (recurDays.length > 0 && recurEnd && occurrences.length > 0) : !!date
  )

  const inputStyle = { width: '100%', border: 'none', borderBottom: '2px solid #ccd', fontSize: '0.9rem', padding: '4px 2px', outline: 'none', color: '#111', background: 'transparent', fontWeight: 600 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 20px 36px', width: '100%', maxWidth: 700, margin: '0 auto', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontWeight: 900, color: COLORS.navy, fontSize: '1rem' }}>{initial?.id ? 'Edit Job' : 'Add Job'}</div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: '1.4rem', color: '#aaa' }}>✕</button>
        </div>

        {error && (
          <div style={{ background: '#fff0ee', border: `1px solid ${COLORS.coral}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: COLORS.coral, fontSize: '0.82rem', fontWeight: 700 }}>
            ⚠ {error}
          </div>
        )}

        <JobField label="Client">
          {clients.length > 0 ? (
            <select value={clientId} onChange={e => handleClientChange(e.target.value)} style={{ ...inputStyle }}>
              <option value="">-- Select Client --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__manual__">+ Enter manually</option>
            </select>
          ) : (
            <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Client name" style={inputStyle} />
          )}
          {clientId === '__manual__' && (
            <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Enter client name" style={{ ...inputStyle, marginTop: 8 }} />
          )}
        </JobField>

        {clientDogs.length > 0 && (
          <JobField label={clientDogs.length > 1 ? 'Dogs (all included — uncheck any not on this visit)' : 'Dog'}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {clientDogs.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDog(d.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontWeight: 800, fontSize: '0.82rem',
                    background: dogIds.includes(d.id) ? COLORS.blue : '#fff',
                    color: dogIds.includes(d.id) ? '#fff' : COLORS.navy,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  }}
                >🐾 {d.name}{d.breed ? ` (${d.breed})` : ''}</button>
              ))}
            </div>
          </JobField>
        )}

        {(!clientId || clientId === '__manual__') && (
          <JobField label="Dog Name">
            <input value={dogName} onChange={e => setDogName(e.target.value)} placeholder="Dog's name" style={inputStyle} />
          </JobField>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <JobField label={recurring ? 'Start Date *' : 'Date *'}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          </JobField>
          <JobField label="Time">
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
          </JobField>
        </div>

        <JobField label="Service">
          <select value={svcType} onChange={e => {
            const v = parseInt(e.target.value)
            setSvcType(v)
            setDuration(v === 2 || v === 3 ? 1 : 15)
          }} style={inputStyle}>
            {SERVICES.slice(1).map((s, i) => <option key={i} value={i+1}>{s.name}</option>)}
          </select>
        </JobField>

        <JobField label={svcType === 1 || svcType === 4 ? 'Duration (min)' : 'Visits'}>
          <input type="number" value={duration} min="1" onChange={e => setDuration(parseInt(e.target.value) || 1)} style={inputStyle} />
        </JobField>

        <JobField label="Notes">
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special instructions..." style={inputStyle} />
        </JobField>

        {/* Recurring toggle — only show for new jobs */}
        {!initial?.id && (
          <div style={{ marginTop: 4, marginBottom: 12 }}>
            <button
              onClick={() => setRecurring(r => !r)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: recurring ? COLORS.lightBlue : '#f5f5f5',
                border: `2px solid ${recurring ? COLORS.blue : '#ddd'}`,
                borderRadius: 12, padding: '10px 14px', width: '100%', cursor: 'pointer',
              }}
            >
              <div style={{
                width: 38, height: 22, borderRadius: 11,
                background: recurring ? COLORS.blue : '#ccc',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: 3, left: recurring ? 19 : 3,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.2s',
                }} />
              </div>
              <span style={{ fontWeight: 800, color: COLORS.navy, fontSize: '0.9rem' }}>Repeat (Recurring)</span>
            </button>

            {recurring && (
              <div style={{ background: COLORS.lightBlue, borderRadius: 12, padding: '14px', marginTop: 10 }}>
                <div style={{ fontSize: '0.68rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 8 }}>Repeat on Days</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  {WEEK_DAYS.map((d, i) => (
                    <button
                      key={d}
                      onClick={() => toggleRecurDay(i)}
                      style={{
                        padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontWeight: 800, fontSize: '0.8rem',
                        background: recurDays.includes(i) ? COLORS.blue : '#fff',
                        color: recurDays.includes(i) ? '#fff' : COLORS.navy,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                      }}
                    >{d}</button>
                  ))}
                </div>

                <div style={{ fontSize: '0.68rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>End Date</div>
                <input
                  type="date"
                  value={recurEnd}
                  min={date || undefined}
                  onChange={e => setRecurEnd(e.target.value)}
                  style={{ ...inputStyle, background: '#fff', padding: '6px 8px', borderRadius: 8, borderBottom: 'none', border: '1.5px solid #c8e0f0' }}
                />

                {occurrences.length > 0 && (
                  <div style={{ marginTop: 12, background: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', color: COLORS.darkBlue, fontWeight: 700 }}>
                    📅 This will create <span style={{ color: COLORS.coral, fontWeight: 900 }}>{occurrences.length} jobs</span>
                    {recurDays.length > 0 && ` · ${recurDays.map(d => WEEK_DAYS[d]).join(', ')}`}
                    {recurEnd && ` through ${recurEnd}`}
                  </div>
                )}
                {recurring && recurDays.length > 0 && recurEnd && occurrences.length === 0 && (
                  <div style={{ marginTop: 12, background: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: '0.82rem', color: COLORS.coral, fontWeight: 700 }}>
                    No occurrences — check start and end dates
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button onClick={handleSave} disabled={saving || !canSave}
          style={{ width: '100%', marginTop: 8, background: saving || !canSave ? '#ccc' : COLORS.coral, color: '#fff', border: 'none', padding: '14px', borderRadius: 14, fontSize: '1rem', fontWeight: 800 }}>
          {saving ? 'Saving...' : initial?.id ? 'Update Job' : recurring && occurrences.length > 0 ? `Add ${occurrences.length} Jobs` : 'Add Job'}
        </button>
      </div>
    </div>
  )
}

function PasteTextPanel({ clients, onSaved, onCancel }) {
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState(null)
  const [rows, setRows] = useState(null) // null = not parsed yet; array once parsed
  const [saving, setSaving] = useState(false)

  const rowInputStyle = { width: '100%', border: 'none', borderBottom: '1px solid #aac', fontSize: '0.85rem', padding: '3px 2px', outline: 'none', background: 'transparent', fontWeight: 600 }
  const rowLabelStyle = { fontSize: '0.62rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 2 }

  const findServiceIdx = (name) => {
    const idx = SERVICES.findIndex((s, i) => i > 0 && s.name.toLowerCase() === String(name || '').toLowerCase())
    return idx > 0 ? idx : 1
  }

  const handleParse = async () => {
    if (!text.trim()) return
    setParsing(true)
    setError(null)
    try {
      const res = await fetch('/api/parse-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to parse text')
      const jobs = (json.jobs || []).map(j => ({
        client_name: j.client_name || '',
        dog_name: j.dog_name || '',
        job_date: j.job_date || '',
        job_time: j.job_time || '',
        service_idx: findServiceIdx(j.service_type),
      }))
      setRows(jobs)
    } catch (err) {
      setError(err.message || 'Error parsing text')
    } finally {
      setParsing(false)
    }
  }

  const updateRow = (i, field, val) => {
    setRows(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: val }; return n })
  }
  const removeRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    if (!rows || rows.length === 0) return
    setSaving(true)
    const clientsByName = new Map(clients.map(c => [c.name.toLowerCase().trim(), c]))

    const payload = rows
      .filter(r => r.client_name.trim() && r.job_date)
      .map(r => {
        const matchedClient = clientsByName.get(r.client_name.toLowerCase().trim())
        let dogName = r.dog_name.trim()
        let dogId = null
        if (matchedClient) {
          if (dogName) {
            const matchedDog = (matchedClient.dogs || []).find(d => d.name.toLowerCase() === dogName.toLowerCase())
            if (matchedDog) dogId = matchedDog.id
          } else if ((matchedClient.dogs || []).length > 0) {
            dogName = matchedClient.dogs.map(d => d.name).join(', ')
          }
        }
        return {
          client_id: matchedClient ? matchedClient.id : null,
          client_name: matchedClient ? matchedClient.name : r.client_name.trim(),
          dog_id: dogId,
          dog_name: dogName,
          job_date: r.job_date,
          job_time: r.job_time || null,
          service_type: r.service_idx,
          duration: r.service_idx === 2 || r.service_idx === 3 ? 1 : 15,
          notes: '',
          invoiced: false,
        }
      })

    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    await onSaved()
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '20px', marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight: 900, color: COLORS.navy, fontSize: '1rem', marginBottom: 4 }}>Paste Client Text</div>

      {rows === null ? (
        <>
          <div style={{ color: '#888', fontSize: '0.82rem', marginBottom: 14 }}>
            Paste a text message from a client, e.g. <em>"Can you walk Buddy Monday and Wednesday at 4pm this week?"</em>
          </div>
          {error && (
            <div style={{ background: '#fff0ee', border: `1px solid ${COLORS.coral}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: COLORS.coral, fontSize: '0.82rem', fontWeight: 700 }}>
              ⚠ {error}
            </div>
          )}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste the client's message here..."
            rows={4}
            style={{ width: '100%', border: '1.5px solid #dde', borderRadius: 10, padding: '10px 12px', fontSize: '0.88rem', outline: 'none', marginBottom: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancel} style={{ padding: '10px 20px', background: '#f5f5f5', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '0.85rem' }}>Cancel</button>
            <button onClick={handleParse} disabled={!text.trim() || parsing}
              style={{ flex: 1, padding: '10px', background: !text.trim() || parsing ? '#ccc' : COLORS.coral, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.9rem' }}>
              {parsing ? 'Reading message...' : 'Parse Message'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ color: rows.length ? COLORS.green : COLORS.coral, fontSize: '0.82rem', fontWeight: 700, marginBottom: 12 }}>
            {rows.length ? `✓ Found ${rows.length} job${rows.length !== 1 ? 's' : ''} — review before saving` : 'No jobs found in that message'}
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ background: COLORS.lightBlue, borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                <div>
                  <div style={rowLabelStyle}>Client</div>
                  <input value={r.client_name} onChange={e => updateRow(i, 'client_name', e.target.value)} style={rowInputStyle} />
                </div>
                <div>
                  <div style={rowLabelStyle}>Dog(s)</div>
                  <input value={r.dog_name} onChange={e => updateRow(i, 'dog_name', e.target.value)} style={rowInputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
                <div>
                  <div style={rowLabelStyle}>Date</div>
                  <input type="date" value={r.job_date} onChange={e => updateRow(i, 'job_date', e.target.value)} style={rowInputStyle} />
                </div>
                <div>
                  <div style={rowLabelStyle}>Time</div>
                  <input type="time" value={r.job_time} onChange={e => updateRow(i, 'job_time', e.target.value)} style={rowInputStyle} />
                </div>
                <div>
                  <div style={rowLabelStyle}>Service</div>
                  <select value={r.service_idx} onChange={e => updateRow(i, 'service_idx', parseInt(e.target.value))} style={rowInputStyle}>
                    {SERVICES.slice(1).map((s, si) => <option key={si} value={si + 1}>{s.name}</option>)}
                  </select>
                </div>
                <button onClick={() => removeRow(i)}
                  style={{ background: COLORS.lightRed, border: 'none', borderRadius: 6, padding: '5px 8px', fontSize: '0.72rem', color: COLORS.coral, fontWeight: 700 }}>✕</button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <button onClick={() => setRows(null)} style={{ padding: '10px 16px', background: '#f5f5f5', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '0.85rem' }}>Back</button>
            <button onClick={onCancel} style={{ padding: '10px 16px', background: '#f5f5f5', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '0.85rem' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || rows.length === 0}
              style={{ flex: 1, padding: '10px', background: saving || rows.length === 0 ? '#ccc' : COLORS.coral, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.9rem' }}>
              {saving ? 'Saving...' : `Save ${rows.length} Job${rows.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Walks [startDate, endDate] and pairs each day with the template entries that
// should run on it. With no time window, every entry runs every day (unchanged
// default behavior). With a time window: the first day only keeps entries at
// or after fromTime, the last day only keeps entries at or before toTime, and
// every day in between keeps all entries regardless of time — a single-day
// range applies both bounds at once, which also covers the "just today" case.
function computeTemplateOccurrences(template, startDate, endDate, fromTime, toTime) {
  if (!startDate || !endDate) return []
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  if (end < start) return []

  const occurrences = []
  const cur = new Date(start)
  while (cur <= end) {
    const dateStr = cur.toISOString().split('T')[0]
    const isFirstDay = dateStr === startDate
    const isLastDay = dateStr === endDate
    for (const entry of template) {
      let include = true
      if (entry.time) {
        if (isFirstDay && fromTime && entry.time < fromTime) include = false
        if (isLastDay && toTime && entry.time > toTime) include = false
      }
      if (include) occurrences.push({ date: dateStr, entry })
    }
    cur.setDate(cur.getDate() + 1)
  }
  return occurrences
}

function ApplyTemplatePanel({ clients, onSaved, onCancel }) {
  const templatedClients = clients.filter(c => (c.default_schedule || []).length > 0)
  const [clientId, setClientId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [fromTime, setFromTime] = useState('')
  const [toTime, setToTime] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedClient = templatedClients.find(c => c.id === clientId)
  const template = selectedClient?.default_schedule || []

  const dayCount = (() => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    if (end < start) return 0
    return Math.floor((end - start) / 86400000) + 1
  })()

  const occurrences = computeTemplateOccurrences(template, startDate, endDate, fromTime, toTime)
  const totalJobs = occurrences.length

  const dayLabel = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : ''
  const dayTimeLabel = (dateStr, timeStr) => timeStr ? `${dayLabel(dateStr)} ${formatTime(timeStr)}` : dayLabel(dateStr)

  const handleGenerate = async () => {
    if (!selectedClient || !startDate || !endDate || occurrences.length === 0) return
    setSaving(true)

    const dogName = (selectedClient.dogs || []).map(d => d.name).join(', ')
    const rows = occurrences.map(({ date, entry }) => ({
      client_id: selectedClient.id,
      client_name: selectedClient.name,
      dog_id: null,
      dog_name: dogName,
      job_date: date,
      job_time: entry.time || null,
      service_type: entry.service_type || 1,
      duration: entry.duration || (entry.service_type === 2 || entry.service_type === 3 ? 1 : 15),
      notes: entry.notes || '',
      invoiced: false,
    }))

    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rows),
    })
    setSaving(false)
    await onSaved()
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '20px', marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight: 900, color: COLORS.navy, fontSize: '1rem', marginBottom: 4 }}>Apply Template</div>

      {templatedClients.length === 0 ? (
        <>
          <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: 14 }}>
            No clients have a default schedule set up yet — add one from the Clients tab first.
          </div>
          <button onClick={onCancel} style={{ padding: '10px 20px', background: '#f5f5f5', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '0.85rem' }}>Close</button>
        </>
      ) : (
        <>
          <div style={{ color: '#888', fontSize: '0.82rem', marginBottom: 14 }}>
            Pick a client and a date range — their default jobs will be created for every day in that range.
          </div>

          <JobField label="Client">
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              style={{ width: '100%', border: 'none', borderBottom: '2px solid #ccd', fontSize: '0.9rem', padding: '4px 2px', outline: 'none', color: '#111', background: 'transparent', fontWeight: 600 }}>
              <option value="">-- Select Client --</option>
              {templatedClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </JobField>

          {selectedClient && (
            <div style={{ color: '#666', fontSize: '0.78rem', marginBottom: 12 }}>
              {template.length} default job{template.length !== 1 ? 's' : ''}: {template.map(t => SERVICES[t.service_type]?.name).join(', ')}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: '0.62rem', color: '#888', fontWeight: 700, marginBottom: 3 }}>FROM</div>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{ width: '100%', border: 'none', borderBottom: `2px solid ${COLORS.blue}`, fontSize: '0.9rem', padding: '4px 2px', outline: 'none', background: 'transparent', fontWeight: 600 }} />
            </div>
            <div>
              <div style={{ fontSize: '0.62rem', color: '#888', fontWeight: 700, marginBottom: 3 }}>TO</div>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                style={{ width: '100%', border: 'none', borderBottom: `2px solid ${COLORS.blue}`, fontSize: '0.9rem', padding: '4px 2px', outline: 'none', background: 'transparent', fontWeight: 600 }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: '0.62rem', color: '#888', fontWeight: 700, marginBottom: 3 }}>FROM TIME (OPTIONAL)</div>
              <input type="time" value={fromTime} onChange={e => setFromTime(e.target.value)}
                style={{ width: '100%', border: 'none', borderBottom: '2px solid #ccd', fontSize: '0.9rem', padding: '4px 2px', outline: 'none', background: 'transparent', fontWeight: 600 }} />
            </div>
            <div>
              <div style={{ fontSize: '0.62rem', color: '#888', fontWeight: 700, marginBottom: 3 }}>TO TIME (OPTIONAL)</div>
              <input type="time" value={toTime} onChange={e => setToTime(e.target.value)}
                style={{ width: '100%', border: 'none', borderBottom: '2px solid #ccd', fontSize: '0.9rem', padding: '4px 2px', outline: 'none', background: 'transparent', fontWeight: 600 }} />
            </div>
          </div>
          <div style={{ color: '#999', fontSize: '0.72rem', marginBottom: 12 }}>
            Leave blank to include every default job on every day. Set both to only cover jobs within that window on the first and last day.
          </div>

          {totalJobs > 0 && (
            <div style={{ background: COLORS.lightBlue, borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: '0.82rem', color: COLORS.darkBlue, fontWeight: 700 }}>
              📅 This will create <span style={{ color: COLORS.coral, fontWeight: 900 }}>{totalJobs} job{totalJobs !== 1 ? 's' : ''}</span>{' '}
              {(fromTime || toTime)
                ? <>between {dayTimeLabel(startDate, fromTime)} and {dayTimeLabel(endDate, toTime)}</>
                : <>across {dayCount} day{dayCount !== 1 ? 's' : ''}</>}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onCancel} style={{ padding: '10px 20px', background: '#f5f5f5', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: '0.85rem' }}>Cancel</button>
            <button onClick={handleGenerate} disabled={saving || totalJobs === 0}
              style={{ flex: 1, padding: '10px', background: saving || totalJobs === 0 ? '#ccc' : COLORS.coral, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: '0.9rem' }}>
              {saving ? 'Creating...' : totalJobs > 0 ? `Create ${totalJobs} Jobs` : 'Generate Jobs'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
