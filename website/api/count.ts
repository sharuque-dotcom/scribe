// Anonymous usage counts for StepCrumb: "a guide was made", "a PDF was exported",
// "someone clicked Add to Chrome". Only the event name is sent. No cookies, IDs,
// URLs or content. The IP is used only, hashed with the date, to cap counts per
// network per day; the hash expires after a day and the IP is never stored.
// Storage: Upstash Redis (Vercel Marketplace), through its REST API.

export const EVENTS = [
  'guide_created',
  'export_pdf',
  'export_docx',
  'export_html',
  'export_md',
  'export_json',
  'export_video',
  'export_captions',
  'export_sop',
  'export_training',
  'install_click',
] as const
export type CountEvent = (typeof EVENTS)[number]

const DAILY_CAP = 300

type Cmd = (string | number)[]
export type Redis = (cmds: Cmd[]) => Promise<unknown[]>

function upstash(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return async (cmds) => {
    const r = await fetch(`${url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(cmds) })
    if (!r.ok) throw new Error(`redis ${r.status}`)
    return ((await r.json()) as { result: unknown }[]).map((x) => x.result)
  }
}

const day = (d = new Date()) => d.toISOString().slice(0, 10)

async function sha(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') ?? ''
  const ok = o.startsWith('chrome-extension://') || o.startsWith('extension://') || /^https:\/\/(www\.)?stepcrumb\.com$/.test(o)
  return ok ? { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {}
}

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } })

// Record one event. Exported with an injectable store for tests.
export async function record(req: Request, redis: Redis | null): Promise<Response> {
  const h = cors(req)
  if (!redis) return json({ ok: false, error: 'not configured' }, 503, h)
  let e: unknown
  try {
    e = ((await req.json()) as { e?: unknown }).e
  } catch {
    return json({ ok: false }, 400, h)
  }
  if (typeof e !== 'string' || !(EVENTS as readonly string[]).includes(e)) return json({ ok: false }, 400, h)
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  const today = day()
  const cap = `cap:${today}:${await sha(`${ip}|${today}`)}`
  const [n] = (await redis([['INCR', cap], ['EXPIRE', cap, 86400]])) as number[]
  if (n > DAILY_CAP) return json({ ok: true, capped: true }, 202, h)
  await redis([['INCR', `count:${e}`], ['INCR', `count:${e}:${today}`], ['EXPIRE', `count:${e}:${today}`, 60 * 60 * 24 * 120]])
  return json({ ok: true }, 202, h)
}

// Totals and the last 30 days per event.
export async function totals(req: Request, redis: Redis | null): Promise<Response> {
  const h = cors(req)
  if (!redis) return json({ ok: false, error: 'not configured' }, 503, h)
  const days = Array.from({ length: 30 }, (_, i) => day(new Date(Date.now() - i * 86400000))).reverse()
  const cmds: Cmd[] = []
  for (const e of EVENTS) {
    cmds.push(['GET', `count:${e}`])
    for (const d of days) cmds.push(['GET', `count:${e}:${d}`])
  }
  const res = await redis(cmds)
  const out: Record<string, { total: number; days: Record<string, number> }> = {}
  let i = 0
  for (const e of EVENTS) {
    const total = Number(res[i++] ?? 0)
    const per: Record<string, number> = {}
    for (const d of days) {
      const v = Number(res[i++] ?? 0)
      if (v) per[d] = v
    }
    out[e] = { total, days: per }
  }
  return json({ ok: true, counts: out }, 200, { ...h, 'Cache-Control': 'public, max-age=60' })
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cors(req) })
}
export function POST(req: Request) {
  return record(req, upstash())
}
export function GET(req: Request) {
  return totals(req, upstash())
}
