export default function handler(req, res) {
  const { date, time, service, client, dog, duration } = req.query

  if (!date) return res.status(400).json({ error: 'Missing date' })

  // Parse start datetime
  const timeStr = time || '09:00'
  const [h, m] = timeStr.split(':').map(Number)
  const startDt = new Date(`${date}T${timeStr}:00`)

  // Duration in minutes — default 60 if not provided
  const durationMin = parseInt(duration) || 60
  const endDt = new Date(startDt.getTime() + durationMin * 60 * 1000)

  const pad = n => String(n).padStart(2, '0')
  const fmt = (d) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`

  const summary = `${service || 'Dog Walking'} - ${client || 'Client'}`
  const description = [
    dog ? `Dog: ${dog}` : '',
    `Service: ${service || 'Dog Walking'}`,
    'Love 4 Dogs - 601-946-3924',
  ].filter(Boolean).join('\\n')

  const uid = `love4dogs-${date}-${client || 'job'}-${Date.now()}@love4dogs`

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Love4Dogs//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${fmt(startDt)}`,
    `DTEND:${fmt(endDt)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Job in 30 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const filename = `love4dogs-${date}-${(client || 'job').replace(/\s+/g, '-')}.ics`

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.status(200).send(ics)
}
