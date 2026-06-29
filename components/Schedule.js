import { useState, useEffect, useRef } from 'react'
import {
  COLORS, SERVICES, SERVICE_COLORS, getDaysInMonth, getFirstDayOfMonth,
  dateToKey, todayISO, MONTH_NAMES, DAY_NAMES, formatTime, parseVoiceJob
} from '../lib/helpers'
import Toast from './Toast'

export default function Schedule({ clients, dogs }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [jobs, setJobs] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editJob, setEditJob] = useState(null)
  const [voiceMode, setVoiceMode] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [parsedJob, setParsedJob] = useState(null)
  const [toast, setToast] = useState(null)
  const recognitionRef = useRef(null)

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

  // Voice recording
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      showToast('Voice not supported in this browser')
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript
      setTranscript(text)
      const parsed = parseVoiceJob(text, clientsWithDogs)
      setParsedJob(parsed)
      setListening(false)
    }
    recognition.onerror = (e) => {
      setListening(false)
      // 'aborted' fires normally in Chrome after a successful result with continuous:false — ignore it
      if (e.error === 'aborted') return
      if (e.error === 'not-allowed' || e.error === 'permission-denied') {
        showToast('Microphone permission denied — check browser settings')
      } else if (e.error === 'no-speech') {
        showToast('No speech detected — try again')
      } else if (e.error === 'audio-capture') {
        showToast('No microphone found')
      } else {
        showToast(`Voice error: ${e.error || 'unknown'} — try again`)
      }
    }
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch (err) {
      setListening(false)
      showToast('Could not start microphone — try again')
      return
    }
    setListening(true)
    setTranscript('')
    setParsedJob(null)
  }

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop()
    setListening(false)
  }

  const saveVoiceJob = async () => {
    if (!parsedJob) return
    if (!parsedJob.job_date) { showToast('Please fill in the date field above'); return }
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: parsedJob.client_id || null,
        client_name: parsedJob.client_name || 'Unknown',
        dog_id: parsedJob.dog_id || null,
        dog_name: parsedJob.dog_name || '',
        job_date: parsedJob.job_date,
        job_time: parsedJob.job_time || null,
        service_type: parsedJob.service_idx || 1,
        notes: parsedJob.notes || '',
        invoiced: false,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showToast(`Save failed: ${err.error || res.status}`)
      return
    }
    await loadJobs()
    setVoiceMode(false)
    setTranscript('')
    setParsedJob(null)
    showToast('Job added! 🐾')
  }

  return (
    <div style={{ padding: '14px 16px', maxWidth: 700, margin: '0 auto' }}>
      {toast && <Toast msg={toast} />}

      {/* Voice mode */}
      {voiceMode ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px', marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          <div style={{ fontWeight: 900, color: COLORS.navy, fontSize: '1rem', marginBottom: 4 }}>🎤 Voice Add Job</div>
          <div style={{ color: '#888', fontSize: '0.82rem', marginBottom: 16 }}>
            Say something like:<br />
            <em>"Walk Mrs. Johnson's dog Buddy on Tuesday at 3pm"</em>
          </div>

          <button
            onClick={listening ? stopListening : startListening}
            style={{
              width: 80, height: 80, borderRadius: '50%', border: 'none',
              background: listening ? COLORS.coral : COLORS.blue,
              color: '#fff', fontSize: '2rem', cursor: 'pointer',
              boxShadow: listening ? '0 0 0 8px rgba(224,90,58,0.2)' : '0 4px 16px rgba(91,188,228,0.4)',
              transition: 'all 0.2s', marginBottom: 16,
            }}>
            {listening ? '⏹' : '🎤'}
          </button>

          {listening && <div style={{ color: COLORS.coral, fontWeight: 700, fontSize: '0.85rem', marginBottom: 12 }}>Listening...</div>}

          {transcript && (
            <div style={{ background: COLORS.lightBlue, borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: '0.85rem', color: COLORS.navy }}>
              <strong>Heard:</strong> &ldquo;{transcript}&rdquo;
            </div>
          )}

          {parsedJob && (
            <div style={{ background: '#f7fbfe', borderRadius: 10, padding: '12px 14px', marginBottom: 14, textAlign: 'left' }}>
              <div style={{ fontWeight: 800, color: COLORS.navy, marginBottom: 8, fontSize: '0.85rem' }}>Parsed as:</div>
              <ParsedRow label="Client" value={parsedJob.client_name || '—'} />
              <ParsedRow label="Dog" value={parsedJob.dog_name || '—'} />
              <ParsedRow label="Service" value={SERVICES[parsedJob.service_idx]?.name || '—'} />
              <ParsedRow label="Date" value={parsedJob.job_date || '—'} />
              <ParsedRow label="Time" value={parsedJob.job_time ? formatTime(parsedJob.job_time) : '—'} />

              {!parsedJob.client_name && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: '0.65rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 3 }}>Client Name</div>
                  <input value={parsedJob.client_name || ''} onChange={e => setParsedJob(p => ({ ...p, client_name: e.target.value }))}
                    style={{ width: '100%', border: 'none', borderBottom: '2px solid #ccd', fontSize: '0.9rem', padding: '3px 2px', outline: 'none', background: 'transparent', fontWeight: 600 }} />
                </div>
              )}
              {!parsedJob.job_date && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: '0.65rem', color: COLORS.coral, fontWeight: 800, textTransform: 'uppercase', marginBottom: 3 }}>Date *</div>
                  <input type="date" value={parsedJob.job_date || ''} onChange={e => setParsedJob(p => ({ ...p, job_date: e.target.value }))}
                    style={{ width: '100%', border: 'none', borderBottom: '2px solid #ccd', fontSize: '0.9rem', padding: '3px 2px', outline: 'none', background: 'transparent', fontWeight: 600 }} />
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setVoiceMode(false); setTranscript(''); setParsedJob(null) }}
              style={{ flex: 1, padding: '11px', background: '#f5f5f5', border: 'none', borderRadius: 12, fontWeight: 700 }}>
              Cancel
            </button>
            {parsedJob && (
              <button onClick={saveVoiceJob} disabled={!parsedJob.job_date}
                style={{ flex: 2, padding: '11px', background: !parsedJob.job_date ? '#ccc' : COLORS.coral, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800 }}>
                {!parsedJob.job_date ? 'Fill in date above' : 'Add Job'}
              </button>
            )}
            {transcript && !parsedJob && (
              <button onClick={startListening}
                style={{ flex: 2, padding: '11px', background: COLORS.blue, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800 }}>
                Try Again
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={() => setVoiceMode(true)}
            style={{ flex: 1, background: COLORS.blue, color: '#fff', border: 'none', padding: '11px', borderRadius: 14, fontWeight: 800, fontSize: '0.9rem' }}>
            🎤 Voice Add
          </button>
          <button onClick={() => { setEditJob(null); setShowForm(true) }}
            style={{ flex: 1, background: COLORS.coral, color: '#fff', border: 'none', padding: '11px', borderRadius: 14, fontWeight: 800, fontSize: '0.9rem' }}>
            + Manual Add
          </button>
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

      {/* Calendar */}
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: COLORS.lightBlue }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ textAlign: 'center', padding: '8px 2px', fontSize: '0.68rem', fontWeight: 800, color: COLORS.darkBlue, textTransform: 'uppercase' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {Array(firstDay).fill(null).map((_, i) => (
            <div key={`e${i}`} style={{ minHeight: 58, borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0' }} />
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
                  minHeight: 58, padding: '3px', cursor: 'pointer',
                  borderBottom: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0',
                  background: isSelected ? COLORS.lightBlue : isToday ? '#fffbe6' : '#fff',
                }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2,
                  background: isToday ? COLORS.blue : 'transparent',
                  color: isToday ? '#fff' : COLORS.navy, fontWeight: isToday ? 900 : 600, fontSize: '0.8rem',
                }}>{day}</div>
                {dayJobs.slice(0, 2).map((job, ji) => (
                  <div key={ji} style={{
                    background: SERVICE_COLORS[job.service_type] || COLORS.blue,
                    borderRadius: 3, padding: '1px 3px', marginBottom: 1,
                    fontSize: '0.55rem', color: '#fff', fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {job.job_time ? formatTime(job.job_time).replace(' AM','a').replace(' PM','p') + ' ' : ''}{job.dog_name || job.client_name}
                  </div>
                ))}
                {dayJobs.length > 2 && <div style={{ fontSize: '0.55rem', color: '#888', fontWeight: 600 }}>+{dayJobs.length - 2}</div>}
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
          {selectedJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px', color: '#aaa', fontSize: '0.85rem' }}>No jobs — tap + Add Job</div>
          ) : selectedJobs.map(job => (
            <div key={job.id} style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              padding: '10px 12px', marginBottom: 8, borderRadius: 10,
              borderLeft: `4px solid ${SERVICE_COLORS[job.service_type] || COLORS.blue}`,
              background: job.invoiced ? '#f5f5f5' : '#f8fbfe',
            }}>
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
          ))}
        </div>
      )}

      {showForm && (
        <JobForm
          initial={editJob}
          defaultDate={selectedDateKey}
          clients={clientsWithDogs}
          onSave={async () => { await loadJobs(); setShowForm(false); setEditJob(null); showToast('Job saved!') }}
          onCancel={() => { setShowForm(false); setEditJob(null) }}
        />
      )}
    </div>
  )
}

function ParsedRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: '0.82rem' }}>
      <span style={{ color: '#888', fontWeight: 600, minWidth: 60 }}>{label}:</span>
      <span style={{ color: COLORS.navy, fontWeight: 700 }}>{value}</span>
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

function JobForm({ initial, defaultDate, clients, onSave, onCancel }) {
  const [clientId, setClientId] = useState(initial?.client_id || '')
  const [dogId, setDogId] = useState(initial?.dog_id || '')
  const [clientName, setClientName] = useState(initial?.client_name || '')
  const [dogName, setDogName] = useState(initial?.dog_name || '')
  const [date, setDate] = useState(initial?.job_date || defaultDate || '')
  const [time, setTime] = useState(initial?.job_time || '')
  const [svcType, setSvcType] = useState(initial?.service_type || 1)
  const [notes, setNotes] = useState(initial?.notes || '')
  const [saving, setSaving] = useState(false)

  const selectedClient = clients.find(c => c.id === clientId)
  const clientDogs = selectedClient?.dogs || []

  const handleClientChange = (id) => {
    setClientId(id)
    setDogId('')
    setDogName('')
    const c = clients.find(c => c.id === id)
    setClientName(c ? c.name : '')
    if (c?.dogs?.length === 1) {
      setDogId(c.dogs[0].id)
      setDogName(c.dogs[0].name)
    }
  }

  const handleDogChange = (id) => {
    setDogId(id)
    const d = clientDogs.find(d => d.id === id)
    setDogName(d ? d.name : '')
  }

  const handleSave = async () => {
    if (!clientName.trim() || !date) return
    setSaving(true)
    const payload = {
      client_id: clientId || null, client_name: clientName.trim(),
      dog_id: dogId || null, dog_name: dogName.trim(),
      job_date: date, job_time: time || null,
      service_type: svcType, notes: notes.trim(), invoiced: false,
    }
    if (initial) {
      await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: initial.id, ...payload }),
      })
    } else {
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }

    if (time && 'Notification' in window && Notification.permission === 'granted') {
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
    await onSave()
  }

  const inputStyle = { width: '100%', border: 'none', borderBottom: '2px solid #ccd', fontSize: '0.9rem', padding: '4px 2px', outline: 'none', color: '#111', background: 'transparent', fontWeight: 600 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 20px 36px', width: '100%', maxWidth: 700, margin: '0 auto', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontWeight: 900, color: COLORS.navy, fontSize: '1rem' }}>{initial ? 'Edit Job' : 'Add Job'}</div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: '1.4rem', color: '#aaa' }}>✕</button>
        </div>

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
          <JobField label="Dog">
            <select value={dogId} onChange={e => handleDogChange(e.target.value)} style={inputStyle}>
              <option value="">-- Select Dog --</option>
              {clientDogs.map(d => <option key={d.id} value={d.id}>{d.name}{d.breed ? ` (${d.breed})` : ''}</option>)}
            </select>
          </JobField>
        )}

        {(!clientId || clientId === '__manual__') && (
          <JobField label="Dog Name">
            <input value={dogName} onChange={e => setDogName(e.target.value)} placeholder="Dog's name" style={inputStyle} />
          </JobField>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <JobField label="Date *">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          </JobField>
          <JobField label="Time">
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
          </JobField>
        </div>

        <JobField label="Service">
          <select value={svcType} onChange={e => setSvcType(parseInt(e.target.value))} style={inputStyle}>
            {SERVICES.slice(1).map((s, i) => <option key={i} value={i+1}>{s.name}</option>)}
          </select>
        </JobField>

        <JobField label="Notes">
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special instructions..." style={inputStyle} />
        </JobField>

        <button onClick={handleSave} disabled={saving || !clientName.trim() || !date}
          style={{ width: '100%', marginTop: 16, background: saving || !clientName.trim() || !date ? '#ccc' : COLORS.coral, color: '#fff', border: 'none', padding: '14px', borderRadius: 14, fontSize: '1rem', fontWeight: 800 }}>
          {saving ? 'Saving...' : initial ? 'Update Job' : 'Add Job'}
        </button>
      </div>
    </div>
  )
}
