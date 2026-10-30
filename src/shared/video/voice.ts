// Free voiceover. Generates speech on this computer with the Kokoro model and
// caches each sentence, so the same text is never generated twice.
import { getVoiceClip, putVoiceClip, type VoiceClip } from '../db'

export const VOICES: { id: string; label: string }[] = [
  { id: 'af_heart', label: 'Heart (US, female)' },
  { id: 'af_bella', label: 'Bella (US, female)' },
  { id: 'am_michael', label: 'Michael (US, male)' },
  { id: 'am_fenrir', label: 'Fenrir (US, male)' },
  { id: 'bf_emma', label: 'Emma (UK, female)' },
  { id: 'bm_george', label: 'George (UK, male)' },
]

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

export async function speak(text: string, voice: string): Promise<VoiceClip> {
  const key = clipKey(voice, text)
  const cached = await getVoiceClip(key)
  if (cached) return cached
  const id = nextId++
  const clip = await new Promise<VoiceClip>((resolve, reject) => {
    waiting.set(id, { resolve, reject, key })
    // The runtime files ship with the app, next to the page.
    const wasmBase = new URL('ort/', document.baseURI).href
    getWorker().postMessage({ type: 'speak', id, text: text.trim(), voice, wasmBase })
  })
  await putVoiceClip(clip)
  return clip
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

export async function generateClips(
  lines: { stepId: string; text: string }[],
  voice: string,
  onProgress: (p: GenerateProgress) => void,
  signal?: AbortSignal,
): Promise<Record<string, VoiceClip>> {
  const todo = lines.filter((l) => l.text.trim())
  const out: Record<string, VoiceClip> = {}
  let download: number | null = null
  onDownload = (loaded, total) => {
    download = total ? loaded / total : null
    onProgress({ done: Object.keys(out).length, total: todo.length, download })
  }
  try {
    for (const l of todo) {
      if (signal?.aborted) break
      onProgress({ done: Object.keys(out).length, total: todo.length, download })
      out[l.stepId] = await speak(l.text, voice)
      download = null
    }
    onProgress({ done: Object.keys(out).length, total: todo.length, download: null })
    return out
  } finally {
    onDownload = null
  }
}
