import Anthropic from '@anthropic-ai/sdk'

const SERVICE_NAMES = ['Dog Walking', 'Feeding & Potty Break', 'Potty Break Only', 'Playtime & Companionship']

export default async function handler(req, res) {
  try {
    return await handleParse(req, res)
  } catch (err) {
    console.error('[parse-schedule] unhandled crash:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

async function handleParse(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text } = req.body || {}
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Missing text' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY environment variable' })
  }

  const client = new Anthropic()

  const today = new Date()
  const todayISO = today.toISOString().split('T')[0]
  const todayDow = today.toLocaleDateString('en-US', { weekday: 'long' })

  const system = `You extract dog-walking / pet-care job requests from a short text message sent by a client.

Today's date is ${todayISO} (a ${todayDow}). Resolve any relative dates ("Monday", "tomorrow", "this week", "next Tuesday") into absolute dates in YYYY-MM-DD format, always in the future relative to today (or today itself) — never in the past.

Valid service_type values (use the closest match; default to "Dog Walking" if unclear): ${SERVICE_NAMES.map(s => `"${s}"`).join(', ')}.

Create one job object per distinct date mentioned. If a dog's name isn't mentioned, leave dog_name as an empty string. If a time isn't mentioned, set job_time to null.

Respond with ONLY a raw JSON array — no prose, no markdown code fences, no explanation. Shape:
[{ "client_name": string, "dog_name": string, "job_date": "YYYY-MM-DD", "job_time": "HH:MM" | null, "service_type": string }]`

  console.log('[parse-schedule] input text:', text)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: text }],
  })

  const raw = response.content.find(b => b.type === 'text')?.text || '[]'
  const cleaned = raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim()

  let jobs
  try {
    jobs = JSON.parse(cleaned)
  } catch (parseErr) {
    console.error('[parse-schedule] JSON parse failed. Raw response:', raw)
    return res.status(500).json({ error: 'Could not parse a response from Claude', raw })
  }

  if (!Array.isArray(jobs)) {
    return res.status(500).json({ error: 'Unexpected response shape from Claude', raw })
  }

  console.log('[parse-schedule] parsed jobs:', jobs)
  return res.status(200).json({ jobs })
}
