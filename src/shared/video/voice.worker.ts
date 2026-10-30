// Runs the free Kokoro voice model in the background so the editor stays responsive.
// The model (~90 MB) downloads from Hugging Face on first use and is cached by the browser.
import { env } from '@huggingface/transformers'
import { KokoroTTS } from 'kokoro-js'

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX'
let model: Promise<KokoroTTS> | null = null

type In = { type: 'speak'; id: number; text: string; voice: string; wasmBase: string }

function load(wasmBase: string) {
  if (!model) {
    const onnx = env.backends.onnx as { wasm?: { wasmPaths?: string; numThreads?: number } }
    onnx.wasm = { ...(onnx.wasm ?? {}), wasmPaths: wasmBase, numThreads: 1 }
    const files: Record<string, { loaded: number; total: number }> = {}
    model = KokoroTTS.from_pretrained(MODEL, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status !== 'progress' || !p.file) return
        files[p.file] = { loaded: p.loaded ?? 0, total: p.total ?? 0 }
        const all = Object.values(files)
        const loaded = all.reduce((a, f) => a + f.loaded, 0)
        const total = all.reduce((a, f) => a + f.total, 0)
        self.postMessage({ type: 'download', loaded, total })
      },
    })
    model.catch(() => (model = null))
  }
  return model
}

self.onmessage = async (e: MessageEvent<In>) => {
  const m = e.data
  if (m.type !== 'speak') return
  try {
    const tts = await load(m.wasmBase)
    const audio = (await tts.generate(m.text, { voice: m.voice as never })) as unknown as { audio: Float32Array; sampling_rate: number }
    const samples = new Float32Array(audio.audio)
    self.postMessage({ type: 'audio', id: m.id, samples, sampleRate: audio.sampling_rate }, { transfer: [samples.buffer] })
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: String((err as Error)?.message ?? err) })
  }
}
