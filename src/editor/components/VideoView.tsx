import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { getVideo, type VoiceClip } from '../../shared/db'
import { download, slug } from '../../shared/export'
import type { Guide, GuideVideo, Step, VideoBackground, ZoomSegment } from '../../shared/types'
import { uid } from '../../shared/types'
import { captionAlpha, drawFrame, layoutFor, outputSize, redactAt } from '../../shared/video/compose'
import { exportVideo } from '../../shared/video/export'
import { cameraAt, cueAt, planVideo, rippleAt, toSrt, toVtt, trackAt } from '../../shared/video/timeline'
import { cachedClips, clipKey, clipMs, generateClips, VOICES, type GenerateProgress } from '../../shared/video/voice'
import { Icon, type ToastData } from '../ui'

const fmt = (ms: number) => {
  const s = Math.max(0, ms) / 1000
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
}

const BACKGROUNDS: { id: VideoBackground; label: string; css: string }[] = [
  { id: 'gradient', label: 'Gradient', css: 'linear-gradient(135deg,#4f46e5,#7c3aed,#db2777)' },
  { id: 'dark', label: 'Dark', css: '#0f172a' },
  { id: 'light', label: 'Light', css: '#e2e8f0' },
  { id: 'none', label: 'None', css: 'repeating-conic-gradient(#e5e7eb 0 25%, #fff 0 50%) 0 0/10px 10px' },
]

interface Props {
  guide: Guide
  update: (fn: (g: Guide) => Guide) => void
  toast: (t: ToastData) => void
}

export function VideoView({ guide, update, toast }: Props) {
  const video = guide.video
  if (!video) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-10">
        <div className="card p-10 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
            <Icon name="video" className="h-6 w-6" />
          </div>
          <h3 className="mb-1 text-base font-semibold">No video for this guide</h3>
          <p className="mx-auto max-w-md text-sm text-muted">
            Turn on <strong>Also record video</strong> in the extension popup before you start capturing. You'll get the steps and a video with auto-zoom, captions and voiceover from the same click-through.
          </p>
        </div>
      </div>
    )
  }
  return <VideoEditor guide={guide} video={video} update={update} toast={toast} />
}

function VideoEditor({ guide, video, update, toast }: Props & { video: GuideVideo }) {
  const settings = video.settings
  const steps = guide.steps
  const [url, setUrl] = useState<string>()
  const [recording, setRecording] = useState<Blob>()
  const [clips, setClips] = useState<Record<string, VoiceClip>>({})
  const [outT, setOutT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [gen, setGen] = useState<GenerateProgress | null>(null)
  const [exporting, setExporting] = useState<number | null>(null)
  const [selZoom, setSelZoom] = useState<string | null>(null)
  const videoEl = useRef<HTMLVideoElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const abort = useRef<AbortController | null>(null)

  const patchVideo = useCallback((p: Partial<GuideVideo>) => update((g) => (g.video ? { ...g, video: { ...g.video, ...p } } : g)), [update])
  const patchSettings = (p: Partial<GuideVideo['settings']>) => patchVideo({ settings: { ...settings, ...p } })

  useEffect(() => {
    let objectUrl: string | undefined
    getVideo(video.blobId).then((v) => {
      if (!v) return
      setRecording(v.blob)
      objectUrl = URL.createObjectURL(v.blob)
      setUrl(objectUrl)
    })
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [video.blobId])

  // Lines the voice will read: one per timed step.
  const lines = useMemo(
    () => steps.filter((s) => s.kind === 'step' && typeof s.time === 'number').map((s) => ({ stepId: s.id, text: (s.narration || s.title).trim() })),
    [steps],
  )
  useEffect(() => {
    cachedClips(lines, settings.voiceName).then(setClips)
  }, [lines, settings.voiceName])

  const voiceMs = useMemo(() => {
    if (!settings.voice) return {}
    const out: Record<string, number> = {}
    for (const l of lines) {
      const c = clips[l.stepId]
      if (c && c.key === clipKey(settings.voiceName, l.text)) out[l.stepId] = clipMs(c)
    }
    return out
  }, [clips, lines, settings.voice, settings.voiceName])
  const missingVoice = settings.voice ? lines.filter((l) => l.text && !voiceMs[l.stepId]).length : 0

  const plan = useMemo(() => planVideo(video, steps, voiceMs), [video, steps, voiceMs])
  const { W, H } = outputSize(video.w, video.h, settings.background, 1280)
  const layout = useMemo(() => layoutFor(W, H, video.w, video.h, settings.background), [W, H, video.w, video.h, settings.background])

  // ---------- drawing ----------

  const draw = useCallback(
    (t: number) => {
      const c = canvas.current
      const v = videoEl.current
      if (!c || !v) return
      const src = plan.map.toSource(t)
      const cue = settings.captions ? cueAt(t, plan.cues) : null
      drawFrame(c.getContext('2d')!, layout, settings.background, v.readyState >= 2 ? v : null, video.w, video.h, {
        cam: cameraAt(src, plan.tracks, plan.zooms),
        cursor: plan.tracks.hasCursor ? trackAt(plan.tracks.cursor, plan.tracks.n, src) : null,
        ripple: rippleAt(src, steps),
        caption: cue ? { text: cue.text, alpha: captionAlpha(t, cue.start, cue.end) } : null,
        redact: redactAt(src, video.redact),
      })
    },
    [plan, layout, settings.background, settings.captions, steps, video.w, video.h, video.redact],
  )

  // Move the hidden video to the right moment, then draw.
  const seek = useCallback(
    (t: number) => {
      const v = videoEl.current
      const clamped = Math.max(0, Math.min(plan.map.outDuration, t))
      setOutT(clamped)
      if (!v) return
      const src = plan.map.toSource(clamped) / 1000
      if (Math.abs(v.currentTime - src) > 0.03) {
        v.currentTime = src
        v.addEventListener('seeked', () => draw(clamped), { once: true })
      } else draw(clamped)
    },
    [plan, draw],
  )

  useEffect(() => {
    if (!playing) seek(outT)
    // Redraw when settings change while paused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, layout, settings.captions, url])

  // ---------- playback ----------

  const audio = useRef<{ ctx: AudioContext; nodes: AudioBufferSourceNode[] } | null>(null)
  const stopAudio = () => {
    audio.current?.nodes.forEach((n) => n.stop())
    audio.current?.ctx.close()
    audio.current = null
  }

  useEffect(() => {
    if (!playing) return
    const v = videoEl.current
    if (!v) return
    const from = outT >= plan.map.outDuration - 50 ? 0 : outT
    const t0 = performance.now() - from
    // Schedule narration from this point.
    if (settings.voice) {
      const ctx = new AudioContext()
      const nodes: AudioBufferSourceNode[] = []
      for (const p of plan.voice) {
        const c = clips[p.stepId]
        if (!c) continue
        const startIn = (p.at - from) / 1000
        const dur = c.samples.length / c.sampleRate
        if (startIn + dur <= 0) continue
        const buf = ctx.createBuffer(1, c.samples.length, c.sampleRate)
        buf.copyToChannel(new Float32Array(c.samples), 0)
        const node = ctx.createBufferSource()
        node.buffer = buf
        node.connect(ctx.destination)
        node.start(ctx.currentTime + Math.max(0, startIn), Math.max(0, -startIn))
        nodes.push(node)
      }
      audio.current = { ctx, nodes }
    }
    v.currentTime = plan.map.toSource(from) / 1000
    let raf = 0
    const tick = () => {
      const t = performance.now() - t0
      if (t >= plan.map.outDuration) {
        setPlaying(false)
        setOutT(plan.map.outDuration)
        return
      }
      const src = plan.map.toSource(t)
      const frozen = plan.map.toSource(t + 40) - src < 1
      if (frozen) {
        if (!v.paused) v.pause()
      } else {
        if (v.paused) void v.play().catch(() => {})
        if (Math.abs(v.currentTime * 1000 - src) > 250) v.currentTime = src / 1000
      }
      setOutT(t)
      draw(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      v.pause()
      stopAudio()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  // ---------- zoom editing ----------

  // Editing any zoom turns the automatic zooms into an editable list.
  const editZooms = (fn: (z: ZoomSegment[]) => ZoomSegment[]) => patchVideo({ zooms: fn(plan.zooms.map((z) => ({ ...z }))).sort((a, b) => a.start - b.start) })
  const strip = useRef<HTMLDivElement>(null)
  const pxToMs = (dx: number) => (dx / (strip.current?.clientWidth || 1)) * video.duration

  const dragZoom = (e: RPointerEvent, z: ZoomSegment, mode: 'move' | 'start' | 'end') => {
    e.stopPropagation()
    e.preventDefault()
    setSelZoom(z.id)
    const x0 = e.clientX
    const orig = { ...z }
    const onMove = (ev: PointerEvent) => {
      const d = pxToMs(ev.clientX - x0)
      editZooms((zs) =>
        zs.map((s) => {
          if (s.id !== z.id) return s
          if (mode === 'move') {
            const start = Math.max(0, Math.min(video.duration - (orig.end - orig.start), orig.start + d))
            return { ...s, start, end: start + (orig.end - orig.start) }
          }
          if (mode === 'start') return { ...s, start: Math.max(0, Math.min(orig.end - 800, orig.start + d)) }
          return { ...s, end: Math.min(video.duration, Math.max(orig.start + 800, orig.end + d)) }
        }),
      )
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const dragTrim = (e: RPointerEvent, which: 'start' | 'end') => {
    e.stopPropagation()
    e.preventDefault()
    const x0 = e.clientX
    const s0 = plan.trimStart
    const e0 = plan.trimEnd
    const onMove = (ev: PointerEvent) => {
      const d = pxToMs(ev.clientX - x0)
      if (which === 'start') patchVideo({ trimStart: Math.round(Math.max(0, Math.min(e0 - 1000, s0 + d))) })
      else patchVideo({ trimEnd: Math.round(Math.min(video.duration, Math.max(s0 + 1000, e0 + d))) })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const srcNow = plan.map.toSource(outT)
  const pct = (ms: number) => `${(ms / video.duration) * 100}%`
  const selected = plan.zooms.find((z) => z.id === selZoom)

  // ---------- voice, export ----------

  const generateVoice = async () => {
    const ctrl = new AbortController()
    abort.current = ctrl
    setGen({ done: 0, total: lines.length, download: null })
    try {
      const made = await generateClips(lines, settings.voiceName, setGen, ctrl.signal)
      setClips((c) => ({ ...c, ...made }))
      if (!settings.voice) patchSettings({ voice: true })
    } catch (err) {
      toast({ text: `Voice failed: ${(err as Error).message}`, tone: 'error' })
    } finally {
      setGen(null)
      abort.current = null
    }
  }

  const runExport = async () => {
    if (!recording) return
    setPlaying(false)
    const ctrl = new AbortController()
    abort.current = ctrl
    setExporting(0)
    try {
      const res = await exportVideo({ recording, video, steps, plan, clips: settings.voice ? clips : {}, onProgress: setExporting, signal: ctrl.signal })
      download(`${slug(guide.title)}.${res.ext}`, res.blob)
      toast({
        text: res.ext === 'mp4' ? 'Video exported as MP4.' : 'Saved as WebM: this browser can’t make MP4. Chrome on Windows or Mac makes MP4.',
      })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') toast({ text: `Export failed: ${(err as Error).message}`, tone: 'error' })
    } finally {
      setExporting(null)
      abort.current = null
    }
  }

  const subtitles = (kind: 'srt' | 'vtt') => {
    const cues = plan.cues.map(({ start, end, text }) => ({ start, end, text }))
    download(`${slug(guide.title)}.${kind}`, kind === 'srt' ? toSrt(cues) : toVtt(cues), kind === 'srt' ? 'application/x-subrip' : 'text/vtt')
  }

  const busy = gen !== null || exporting !== null

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Player (stays in view while the settings column scrolls) */}
        <div className="min-w-0 flex-1 self-start lg:sticky lg:top-20">
          <div className="overflow-hidden rounded-xl border border-line bg-black shadow-soft">
            <canvas ref={canvas} width={W} height={H} className="block h-auto w-full" aria-label="Video preview" />
          </div>
          {url && <video ref={videoEl} src={url} muted playsInline preload="auto" className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0" onLoadedData={() => seek(outT)} />}

          <div className="mt-3 flex items-center gap-3">
            <button className="btn-primary w-24" onClick={() => setPlaying((p) => !p)} disabled={!url || busy} aria-label={playing ? 'Pause' : 'Play'}>
              <Icon name={playing ? 'pause' : 'play'} /> {playing ? 'Pause' : 'Play'}
            </button>
            <input
              type="range"
              min={0}
              max={plan.map.outDuration}
              step={10}
              value={outT}
              onChange={(e) => {
                setPlaying(false)
                seek(Number(e.target.value))
              }}
              className="flex-1 accent-indigo-600"
              aria-label="Seek"
            />
            <span className="w-28 text-right text-xs tabular-nums text-muted">
              {fmt(outT)} / {fmt(plan.map.outDuration)}
            </span>
          </div>

          {/* Timeline */}
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>Timeline · drag zoom blocks to move them, drag their edges to resize, drag the white handles to trim</span>
              <button
                className="font-medium text-accent hover:underline"
                onClick={() => {
                  const id = uid()
                  editZooms((zs) => [...zs, { id, start: Math.max(0, srcNow - 800), end: Math.min(video.duration, srcNow + 2200), scale: settings.zoomScale }])
                  setSelZoom(id)
                }}
              >
                + Add zoom here
              </button>
            </div>
            <div
              ref={strip}
              className="relative h-20 select-none rounded-lg border border-line bg-raised"
              onPointerDown={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                const src = ((e.clientX - r.left) / r.width) * video.duration
                setSelZoom(null)
                setPlaying(false)
                seek(plan.map.toOutput(src))
              }}
            >
              {/* Trimmed-away parts */}
              <div className="absolute inset-y-0 left-0 rounded-l-lg bg-ink/20" style={{ width: pct(plan.trimStart) }} />
              <div className="absolute inset-y-0 right-0 rounded-r-lg bg-ink/20" style={{ width: `calc(100% - ${pct(plan.trimEnd)})` }} />
              {/* Step markers */}
              {steps
                .filter((s): s is Step & { time: number } => s.kind === 'step' && typeof s.time === 'number')
                .map((s, i) => (
                  <div key={s.id} className="absolute top-1.5 -translate-x-1/2" style={{ left: pct(s.time) }} title={s.title}>
                    <div className="grid h-5 w-5 place-items-center rounded-full bg-orange-500 text-[10px] font-bold text-white">{i + 1}</div>
                  </div>
                ))}
              {/* Zooms */}
              {plan.zooms.map((z) => (
                <div
                  key={z.id}
                  className={`absolute bottom-2 h-7 cursor-grab rounded-md border text-[10px] font-semibold text-white ${z.id === selZoom ? 'border-white bg-indigo-600 ring-2 ring-indigo-300' : 'border-indigo-700 bg-indigo-500/90'}`}
                  style={{ left: pct(z.start), width: pct(z.end - z.start) }}
                  onPointerDown={(e) => dragZoom(e, z, 'move')}
                  title="Zoom"
                >
                  <div className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" onPointerDown={(e) => dragZoom(e, z, 'start')} />
                  <span className="pointer-events-none block truncate px-2 leading-7">{z.scale.toFixed(1)}×</span>
                  <div className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" onPointerDown={(e) => dragZoom(e, z, 'end')} />
                </div>
              ))}
              {/* Trim handles */}
              <div className="absolute inset-y-0 w-2 -translate-x-1/2 cursor-ew-resize rounded bg-white shadow ring-1 ring-ink/30" style={{ left: pct(plan.trimStart) }} onPointerDown={(e) => dragTrim(e, 'start')} aria-label="Trim start" />
              <div className="absolute inset-y-0 w-2 -translate-x-1/2 cursor-ew-resize rounded bg-white shadow ring-1 ring-ink/30" style={{ left: pct(plan.trimEnd) }} onPointerDown={(e) => dragTrim(e, 'end')} aria-label="Trim end" />
              {/* Playhead */}
              <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-rec" style={{ left: pct(srcNow) }} />
            </div>
            {selected && (
              <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-xs">
                <span className="font-semibold">Selected zoom</span>
                <span className="text-muted">
                  {fmt(selected.start)}–{fmt(selected.end)}
                </span>
                <label className="flex items-center gap-2">
                  Zoom
                  <input
                    type="range"
                    min={1.2}
                    max={3}
                    step={0.05}
                    value={selected.scale}
                    onChange={(e) => editZooms((zs) => zs.map((s) => (s.id === selected.id ? { ...s, scale: Number(e.target.value) } : s)))}
                    className="w-28 accent-indigo-600"
                    aria-label="Selected zoom level"
                  />
                  {selected.scale.toFixed(1)}×
                </label>
                <button
                  className="ml-auto font-medium text-rec hover:underline"
                  onClick={() => {
                    editZooms((zs) => zs.filter((s) => s.id !== selected.id))
                    setSelZoom(null)
                  }}
                >
                  Delete zoom
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Settings */}
        <aside className="w-full space-y-4 lg:w-80">
          <section className="card space-y-3 p-4 text-sm">
            <h3 className="font-semibold">Export</h3>
            <button className="btn-primary w-full" onClick={runExport} disabled={!recording || busy}>
              <Icon name="download" /> {exporting !== null ? `Exporting… ${Math.round(exporting * 100)}%` : 'Export video'}
            </button>
            {exporting !== null && (
              <div>
                <div className="h-1.5 overflow-hidden rounded bg-raised">
                  <div className="h-full bg-accent transition-all" style={{ width: `${exporting * 100}%` }} />
                </div>
                <button className="mt-1 text-xs text-muted hover:text-rec" onClick={() => abort.current?.abort()}>
                  Cancel
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => subtitles('srt')} disabled={busy}>
                Subtitles .srt
              </button>
              <button className="btn-secondary flex-1" onClick={() => subtitles('vtt')} disabled={busy}>
                .vtt
              </button>
            </div>
            <p className="text-xs text-muted">1080p, 30 fps. Captions and voice are built into the video; the subtitle files are for YouTube or a learning platform.</p>
          </section>

          <section className="card space-y-3 p-4 text-sm">
            <h3 className="font-semibold">Look</h3>
            <label className="flex items-center justify-between gap-3">
              <span>Captions</span>
              <input type="checkbox" checked={settings.captions} onChange={(e) => patchSettings({ captions: e.target.checked })} className="accent-indigo-600" aria-label="Captions" />
            </label>
            <div>
              <div className="mb-1 flex justify-between">
                <span>Auto-zoom level</span>
                <span className="tabular-nums text-muted">{settings.zoomScale.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                min={1.2}
                max={3}
                step={0.05}
                value={settings.zoomScale}
                onChange={(e) => {
                  const z = Number(e.target.value)
                  patchVideo({ settings: { ...settings, zoomScale: z }, zooms: video.zooms?.map((s) => ({ ...s, scale: z })) })
                }}
                className="w-full accent-indigo-600"
                aria-label="Auto-zoom level"
              />
              {video.zooms && (
                <button className="mt-1 text-xs font-medium text-accent hover:underline" onClick={() => patchVideo({ zooms: undefined })}>
                  Reset zooms to automatic
                </button>
              )}
            </div>
            <div>
              <span className="mb-1 block">Background</span>
              <div className="flex gap-2">
                {BACKGROUNDS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => patchSettings({ background: b.id })}
                    title={b.label}
                    aria-label={`Background ${b.label}`}
                    aria-pressed={settings.background === b.id}
                    className={`h-8 flex-1 rounded-md border ${settings.background === b.id ? 'ring-2 ring-accent ring-offset-1' : 'border-line'}`}
                    style={{ background: b.css }}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="card space-y-3 p-4 text-sm">
            <h3 className="font-semibold">Voiceover</h3>
            <label className="flex items-center justify-between gap-3">
              <span>Voiceover in video</span>
              <input type="checkbox" checked={settings.voice} onChange={(e) => patchSettings({ voice: e.target.checked })} className="accent-indigo-600" aria-label="Voiceover" />
            </label>
            <select className="input" value={settings.voiceName} onChange={(e) => patchSettings({ voiceName: e.target.value })} aria-label="Voice">
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            {gen ? (
              <div className="space-y-1">
                <div className="h-1.5 overflow-hidden rounded bg-raised">
                  <div className="h-full bg-accent transition-all" style={{ width: `${((gen.download ?? 0) * 0.3 + (gen.done / Math.max(1, gen.total)) * 0.7) * 100}%` }} />
                </div>
                <p className="text-xs text-muted">
                  {gen.download !== null ? `Downloading the free voice (first time only)… ${Math.round(gen.download * 100)}%` : `Generating line ${Math.min(gen.done + 1, gen.total)} of ${gen.total}…`}
                </p>
                <button className="text-xs text-muted hover:text-rec" onClick={() => abort.current?.abort()}>
                  Stop
                </button>
              </div>
            ) : (
              <button className="btn-secondary w-full" onClick={generateVoice} disabled={busy || !lines.length || missingVoice === 0}>
                <Icon name="sparkle" /> {missingVoice === 0 ? 'Voice is up to date' : missingVoice === lines.length ? 'Generate voiceover' : `Update voice (${missingVoice} line${missingVoice === 1 ? '' : 's'})`}
              </button>
            )}
            <p className="text-xs text-muted">Free voice that runs on this computer. The first time, it downloads about 90 MB. If a line runs long, the video pauses on that frame until it finishes.</p>
          </section>

          <section className="card p-4 text-sm">
            <h3 className="mb-2 font-semibold">Captions and narration</h3>
            <ol className="space-y-2">
              {steps
                .filter((s) => s.kind === 'step' && typeof s.time === 'number')
                .map((s, i) => (
                  <li key={s.id} className="flex gap-2">
                    <button className="mt-1.5 w-10 flex-none text-left text-[11px] tabular-nums text-muted hover:text-accent" onClick={() => {
                        setPlaying(false)
                        // Land just after the step starts, once its caption has faded in.
                        seek(plan.map.toOutput(s.time!) + 300)
                      }} title="Jump here">
                      {i + 1}. {fmt(s.time!)}
                    </button>
                    <textarea
                      rows={2}
                      className="input resize-none py-1.5 text-xs"
                      value={s.narration ?? ''}
                      placeholder={s.title}
                      onChange={(e) => update((g) => ({ ...g, steps: g.steps.map((x) => (x.id === s.id ? { ...x, narration: e.target.value || undefined } : x)) }))}
                      aria-label={`Narration for step ${i + 1}`}
                    />
                  </li>
                ))}
            </ol>
            <p className="mt-2 text-xs text-muted">Leave a line empty to use the step text. Changes here don't change the written guide.</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
