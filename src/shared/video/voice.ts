// Free voiceover. Generates speech on this computer with the Kokoro model and
// caches each sentence, so the same text is never generated twice.
import { FREE_LIMITS } from '../plans'
import { getVoiceClip, putVoiceClip, type VoiceClip } from '../db'

export const VOICES: { id: string; label: string }[] = [
  { id: 'af_heart', label: 'Heart (US, female)' },
  { id: 'af_bella', label: 'Bella (US, female)' },
  { id: 'am_michael', label: 'Michael (US, male)' },
  { id: 'am_fenrir', label: 'Fenrir (US, male)' },
  { id: 'bf_emma', label: 'Emma (UK, female)' },
  { id: 'bm_george', label: 'George (UK, male)' },
]

// The voice included in the free plan.
export const FREE_VOICE = FREE_LIMITS.voice

export const clipKey = (voice: string, text: string) => `${voice}|${text.trim()}`
export const clipMs = (c: VoiceClip) => Math.round((c.samples.length / c.sampleRate) * 1000)

let worker: Worker | null = null
let nextId = 1
const waiting = new Map<number, { resolve: (c: VoiceClip) => void; reject: (e: Error) => void; key: string }>()
let onDownload: ((loaded: number, total: number) => void) | null = null

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./voice.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e) => {
    const m = e.data
    if (m.type === 'download') return onDownload?.(m.loaded, m.total)
    const job = waiting.get(m.id)
    if (!job) return
    waiting.delete(m.id)
    if (m.type === 'audio') job.resolve({ key: job.key, samples: m.samples, sampleRate: m.sampleRate })
    else job.reject(new Error(m.message || 'The voice could not be generated.'))
  }
  worker.onerror = (e) => {
    for (const job of waiting.values()) job.reject(new Error(e.message || 'The voice engine stopped.'))
    waiting.clear()
    worker = null
  }
  return worker
}

// Long lines are spoken in pieces (the model handles shorter text best), split
// at sentence ends, then commas, then spaces. Exported for tests.
export const PIECE_CHARS = 200
export function splitForSpeech(text: string, max = PIECE_CHARS): string[] {
  const t = text.trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t ? [t] : []
  const out: string[] = []
  let rest = t
  while (rest.length > max) {
    const window = rest.slice(0, max + 1)
    let cut = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '))
    if (cut < max * 0.4) cut = window.lastIndexOf(', ')
    if (cut < max * 0.4) cut = window.lastIndexOf(' ')
    if (cut <= 0) {
      // No break point at all (one long token): cut at the limit.
      out.push(rest.slice(0, max))
      rest = rest.slice(max).trim()
      continue
    }
    out.push(rest.slice(0, cut + 1).trim())
    rest = rest.slice(cut + 1).trim()
  }
  if (rest) out.push(rest)
  return out
}

// The engine is restarted every so many pieces, so memory doesn't build up
// over long guides (the model files stay cached, so a restart is quick).
const RECYCLE_EVERY = 12
let piecesSinceStart = 0
function restartWorker() {
  worker?.terminate()
  worker = null
  piecesSinceStart = 0
  for (const job of waiting.values()) job.reject(new Error('The voice engine restarted.'))
  waiting.clear()
}

function speakPiece(text: string, voice: string, key: string): Promise<VoiceClip> {
  if (piecesSinceStart >= RECYCLE_EVERY) restartWorker()
  piecesSinceStart++
  const id = nextId++
  return new Promise<VoiceClip>((resolve, reject) => {
    waiting.set(id, { resolve, reject, key })
    // The runtime files ship with the app, next to the page.
    const wasmBase = new URL('ort/', document.baseURI).href
    getWorker().postMessage({ type: 'speak', id, text, voice, wasmBase })
  })
}

// One piece, retried once on a fresh engine if the first attempt fails.
async function speakPieceWithRetry(text: string, voice: string, key: string): Promise<VoiceClip> {
  try {
    return await speakPiece(text, voice, key)
  } catch {
    restartWorker()
    return speakPiece(text, voice, key)
  }
}

export async function speak(text: string, voice: string): Promise<VoiceClip> {
  const key = clipKey(voice, text)
  const cached = await getVoiceClip(key)
  if (cached) return cached
  const pieces = splitForSpeech(text)
  const parts: VoiceClip[] = []
  for (const p of pieces) parts.push(await speakPieceWithRetry(p, voice, key))
  const clip = parts.length === 1 ? parts[0] : joinClips(parts, key)
  await putVoiceClip(clip)
  return clip
}

// Joins pieces with a short pause between them.
function joinClips(parts: VoiceClip[], key: string): VoiceClip {
  const rate = parts[0].sampleRate
  const gap = Math.round(rate * 0.12)
  const total = parts.reduce((n, p) => n + p.samples.length, 0) + gap * (parts.length - 1)
  const samples = new Float32Array(total)
  let at = 0
  parts.forEach((p, i) => {
    samples.set(p.samples, at)
    at += p.samples.length + (i < parts.length - 1 ? gap : 0)
  })
  return { key, samples, sampleRate: rate }
}

// Already-generated clips for these lines (nothing is generated here).
export async function cachedClips(lines: { stepId: string; text: string }[], voice: string): Promise<Record<string, VoiceClip>> {
  const out: Record<string, VoiceClip> = {}
  await Promise.all(
    lines.map(async (l) => {
      const c = l.text.trim() ? await getVoiceClip(clipKey(voice, l.text)) : undefined
      if (c) out[l.stepId] = c
    }),
  )
  return out
}

export interface GenerateProgress {
  done: number
  total: number
  // Model download progress (first use only), 0..1, or null once loaded.
  download: number | null
}

// Makes every line it can. A line that fails doesn't stop the rest; it is
// reported in `failed` so the screen can offer to try again.
export async function generateClips(
  lines: { stepId: string; text: string }[],
  voice: string,
  onProgress: (p: GenerateProgress) => void,
  signal?: AbortSignal,
): Promise<{ clips: Record<string, VoiceClip>; failed: string[]; error?: string }> {
  const todo = lines.filter((l) => l.text.trim())
  const out: Record<string, VoiceClip> = {}
  const failed: string[] = []
  let error: string | undefined
  let download: number | null = null
  onDownload = (loaded, total) => {
    download = total ? loaded / total : null
    onProgress({ done: Object.keys(out).length, total: todo.length, download })
  }
  try {
    for (const l of todo) {
      if (signal?.aborted) break
      onProgress({ done: Object.keys(out).length + failed.length, total: todo.length, download })
      try {
        out[l.stepId] = await speak(l.text, voice)
      } catch (err) {
        failed.push(l.stepId)
        error = (err as Error).message
      }
      download = null
    }
    onProgress({ done: Object.keys(out).length + failed.length, total: todo.length, download: null })
    return { clips: out, failed, error }
  } finally {
    onDownload = null
  }
}
