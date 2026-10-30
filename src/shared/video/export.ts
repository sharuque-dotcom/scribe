// Turns a recording into the finished video: every frame is drawn with the
// zoom camera, cursor, captions and blur, and the voiceover is mixed in.
// Makes an MP4 (H.264 + AAC) where the browser can encode H.264, which is
// normal Chrome on Windows and Mac; otherwise a WebM (VP9 + Opus).
import {
  ALL_FORMATS,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
} from 'mediabunny'
import { registerAacEncoder } from '@mediabunny/aac-encoder'
import type { VoiceClip } from '../db'
import type { GuideVideo, Step } from '../types'
import { captionAlpha, drawFrame, layoutFor, outputSize, redactAt } from './compose'
import { cameraAt, cueAt, rippleAt, trackAt, type VideoPlan } from './timeline'

export const FPS = 30

export interface ExportResult {
  blob: Blob
  ext: 'mp4' | 'webm'
}

let aacRegistered = false

// Mixes narration clips into one track, placed at their output times.
export async function mixVoice(plan: VideoPlan, clips: Record<string, VoiceClip>, sampleRate = 48000): Promise<AudioBuffer | null> {
  const placed = plan.voice.filter((v) => clips[v.stepId])
  if (!placed.length) return null
  const length = Math.max(1, Math.ceil((plan.map.outDuration / 1000) * sampleRate))
  const ctx = new OfflineAudioContext(1, length, sampleRate)
  for (const v of placed) {
    const c = clips[v.stepId]
    const buf = ctx.createBuffer(1, c.samples.length, c.sampleRate)
    buf.copyToChannel(new Float32Array(c.samples), 0)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start(v.at / 1000)
  }
  return ctx.startRendering()
}

export async function exportVideo(opts: {
  recording: Blob
  video: GuideVideo
  steps: Step[]
  plan: VideoPlan
  clips: Record<string, VoiceClip>
  onProgress: (fraction: number) => void
  signal?: AbortSignal
}): Promise<ExportResult> {
  const { recording, video, steps, plan, clips, onProgress, signal } = opts
  const settings = video.settings
  const input = new Input({ source: new BlobSource(recording), formats: ALL_FORMATS })
  const track = await input.getPrimaryVideoTrack()
  if (!track) throw new Error('The recording has no video in it.')
  const fw = track.displayWidth
  const fh = track.displayHeight
  const { W, H } = outputSize(fw, fh, settings.background)
  const layout = layoutFor(W, H, fw, fh, settings.background)

  const mp4 = await canEncodeVideo('avc', { width: W, height: H })
  const voice = settings.voice ? await mixVoice(plan, clips) : null
  let audioCodec: 'aac' | 'opus' | null = null
  if (voice) {
    if (mp4) {
      if (!(await canEncodeAudio('aac')) && !aacRegistered) {
        registerAacEncoder()
        aacRegistered = true
      }
      audioCodec = 'aac'
    } else audioCodec = 'opus'
  }

  const output = new Output({
    format: mp4 ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
    target: new BufferTarget(),
  })
  const canvas = new OffscreenCanvas(W, H)
  const ctx = canvas.getContext('2d')!
  const videoSource = new CanvasSource(canvas, { codec: mp4 ? 'avc' : 'vp9', bitrate: QUALITY_HIGH })
  output.addVideoTrack(videoSource, { frameRate: FPS })
  const audioSource = audioCodec ? new AudioBufferSource({ codec: audioCodec, bitrate: 128_000 }) : null
  if (audioSource) output.addAudioTrack(audioSource)
  await output.start()

  try {
    if (audioSource && voice) await audioSource.add(voice)

    const frames = Math.max(1, Math.ceil((plan.map.outDuration / 1000) * FPS))
    const sourceTimes = function* () {
      for (let i = 0; i < frames; i++) yield plan.map.toSource((i * 1000) / FPS) / 1000
    }
    const sink = new CanvasSink(track, { poolSize: 3 })
    let last: CanvasImageSource | null = null
    let i = 0
    for await (const wrapped of sink.canvasesAtTimestamps(sourceTimes())) {
      if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')
      if (wrapped) last = wrapped.canvas
      const out = (i * 1000) / FPS
      const src = plan.map.toSource(out)
      const cue = settings.captions ? cueAt(out, plan.cues) : null
      drawFrame(ctx, layout, settings.background, last, fw, fh, {
        cam: cameraAt(src, plan.tracks, plan.zooms),
        cursor: plan.tracks.hasCursor ? trackAt(plan.tracks.cursor, plan.tracks.n, src) : null,
        ripple: rippleAt(src, steps),
        caption: cue ? { text: cue.text, alpha: captionAlpha(out, cue.start, cue.end) } : null,
        redact: redactAt(src, video.redact),
      })
      await videoSource.add(out / 1000, 1 / FPS)
      i++
      if (i % 5 === 0) onProgress(i / frames)
    }
    await output.finalize()
  } catch (err) {
    await output.cancel().catch(() => {})
    throw err
  }
  onProgress(1)
  const buffer = (output.target as BufferTarget).buffer!
  return { blob: new Blob([buffer], { type: mp4 ? 'video/mp4' : 'video/webm' }), ext: mp4 ? 'mp4' : 'webm' }
}
