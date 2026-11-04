import { useEffect, useMemo, useRef, useState } from 'react'
import { deleteGuide, getImage, getVideo, listGuides, putGuide } from '../../shared/db'
import { importGuideJson } from '../../shared/export'
import { renderStep } from '../../shared/render'
import type { CaptureMode, Guide, RecorderState } from '../../shared/types'
import { uid } from '../../shared/types'
import { createSampleGuide } from '../sample'
import { canGuideMe, startGuideMe } from '../guideMe'
import { PlanBadge } from './PlanBadge'
import { SettingsDialog } from './Settings'
import { Icon, isExtension, timeAgo, Toast, type ToastData } from '../ui'

// What a guide is, for its colour, icon and the filter chips.
type Kind = 'guide' | 'both' | 'video'
const kindOf = (g: Guide): Kind => (g.mode === 'video' && g.video ? 'video' : g.video ? 'both' : 'guide')

// Soft colour per kind (tile and card backgrounds) with a matching ink colour.
const TONE: Record<Kind | 'blank', { bg: string; ink: string; icon: string; label: string }> = {
  guide: { bg: '#dbeafe', ink: '#1d4ed8', icon: 'file', label: 'Guide' },
  both: { bg: '#fde2d3', ink: '#c2410c', icon: 'doc', label: 'Guide + video' },
  video: { bg: '#ede9fe', ink: '#6d28d9', icon: 'video', label: 'Video' },
  blank: { bg: '#fce7f3', ink: '#be185d', icon: 'pen', label: 'Blank guide' },
}

const FILTERS: { id: 'all' | 'guides' | 'videos'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'guides', label: 'Guides' },
  { id: 'videos', label: 'Videos' },
]
type Sort = 'edited' | 'created' | 'name'
const SORTS: { id: Sort; label: string }[] = [
  { id: 'edited', label: 'Last edited' },
  { id: 'created', label: 'Date created' },
  { id: 'name', label: 'Name' },
]

// Remembered between visits (per browser); the page works without it.
const remembered = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}
const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage unavailable: just don't remember.
  }
}

// A frame from the start of a video, for guides that have no screenshots.
async function videoThumb(blobId: string): Promise<string | null> {
  const stored = await getVideo(blobId)
  if (!stored) return null
  const url = URL.createObjectURL(stored.blob)
  try {
    const v = document.createElement('video')
    v.muted = true
    v.src = url
    await new Promise((r, j) => {
      v.onloadeddata = r
      v.onerror = j
    })
    v.currentTime = Math.min(0.5, (v.duration || 1) / 2)
    await new Promise((r) => (v.onseeked = r))
    const c = document.createElement('canvas')
    c.width = 480
    c.height = Math.round((480 * v.videoHeight) / (v.videoWidth || 1))
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.8)
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Pastel scribble behind the tiles' icons, like a hand-drawn texture.
function Scribble({ color }: { color: string }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 200 140" preserveAspectRatio="none" aria-hidden="true">
      <path d="M-10 110 C 30 60, 50 140, 90 90 S 150 40, 210 80" fill="none" stroke={color} strokeOpacity="0.11" strokeWidth="10" strokeLinecap="round" strokeDasharray="1 7" />
      <path d="M-10 40 C 40 10, 70 70, 120 30 S 180 20, 210 10" fill="none" stroke={color} strokeOpacity="0.08" strokeWidth="8" strokeLinecap="round" strokeDasharray="1 6" />
    </svg>
  )
}

export function Library() {
  const [guides, setGuides] = useState<Guide[] | null>(null)
  const [thumbs, setThumbs] = useState<Record<string, string | null>>({})
  const [toast, setToast] = useState<ToastData | null>(null)
  const [settings, setSettings] = useState(false)
  const [filter, setFilter] = useState<'all' | 'guides' | 'videos'>('all')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [sort, setSort] = useState<Sort>(() => remembered('library.sort', 'edited') as Sort)
  const [sortOpen, setSortOpen] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>(() => (remembered('library.view', 'grid') === 'list' ? 'list' : 'grid'))
  const [starting, setStarting] = useState<CaptureMode | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)

  const refresh = () => listGuides().then(setGuides)

  useEffect(() => {
    void refresh()
    // Pick up guides captured while this page is open.
    const t = window.setInterval(refresh, 2500)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!guides) return
    for (const g of guides) {
      if (g.id in thumbs) continue
      setThumbs((t) => ({ ...t, [g.id]: null }))
      const first = g.steps.find((s) => s.imageId)
      if (first) getImage(first.imageId!).then((img) => img && renderStep(first, img, { maxWidth: 480 }).then((src) => setThumbs((t) => ({ ...t, [g.id]: src }))))
      else if (g.video) void videoThumb(g.video.blobId).then((src) => src && setThumbs((t) => ({ ...t, [g.id]: src })))
    }
  }, [guides, thumbs])

  useEffect(() => {
    if (searching) searchInput.current?.focus()
  }, [searching])

  const shown = useMemo(() => {
    if (!guides) return []
    const q = query.trim().toLowerCase()
    const list = guides.filter((g) => {
      const k = kindOf(g)
      if (filter === 'guides' && k === 'video') return false
      if (filter === 'videos' && k === 'guide') return false
      return !q || g.title.toLowerCase().includes(q)
    })
    if (sort === 'name') return [...list].sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'created') return [...list].sort((a, b) => b.createdAt - a.createdAt)
    return [...list].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [guides, filter, query, sort])

  const newGuide = async () => {
    const now = Date.now()
    const g: Guide = { id: uid(), title: 'Untitled guide', description: '', createdAt: now, updatedAt: now, status: 'ready', steps: [], docs: {} }
    await putGuide(g)
    location.hash = `#/guide/${g.id}`
  }

  // Starts capturing on the website they were last on (the background brings it
  // to the front). For video, Chrome's share dialog asks what to record.
  const capture = async (mode: CaptureMode) => {
    if (!isExtension) {
      setToast({ text: 'Capturing needs the StepCrumb browser extension.', tone: 'error' })
      return
    }
    setStarting(mode)
    try {
      await chrome.storage.local.set({ recordMode: mode })
      const st = (await chrome.runtime.sendMessage({ type: 'start', mode, fromLibrary: true })) as RecorderState
      if (!st?.recording && st?.notice) setToast({ text: st.notice, tone: 'error' })
    } finally {
      setStarting(null)
    }
  }

  const remove = async (g: Guide) => {
    if (!confirm(`Delete "${g.title}"? This can't be undone.`)) return
    await deleteGuide(g.id)
    void refresh()
  }

  const onImport = async (file?: File) => {
    if (!file) return
    try {
      const g = await importGuideJson(await file.text())
      location.hash = `#/guide/${g.id}`
    } catch (err) {
      setToast({ text: (err as Error).message || 'Could not import that file.', tone: 'error' })
    }
  }

  const href = (g: Guide) => `#/guide/${g.id}${g.mode === 'video' && g.video ? '/video' : ''}`
  const meta = (g: Guide) => (g.status === 'recording' ? 'Capturing now' : `Edited ${timeAgo(g.updatedAt)}`)

  const tiles: { id: CaptureMode | 'blank'; hint: string }[] = [
    { id: 'screenshots', hint: 'A screenshot for every click' },
    { id: 'both', hint: 'The guide, plus a narrated video' },
    { id: 'video', hint: 'Auto-zoom, captions and voice' },
    { id: 'blank', hint: 'Write one from scratch' },
  ]
  const toneFor = (id: CaptureMode | 'blank') => TONE[id === 'screenshots' ? 'guide' : id]

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-center gap-3">
        <img src="./icons/icon48.png" alt="" className="h-9 w-9" />
        <h1 className="mr-auto font-serif text-[2.1rem] font-semibold leading-none tracking-tight" style={{ fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif' }}>
          Library
        </h1>
        <PlanBadge onOpen={() => setSettings(true)} />
        <button className="icon-btn" onClick={() => setSettings(true)} title="Settings" aria-label="Settings">
          <Icon name="settings" />
        </button>
      </header>

      <div className="mb-8 flex flex-wrap items-center gap-2">
        <div className="mr-auto flex items-center gap-1" role="tablist" aria-label="Show">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-3.5 py-1.5 text-[15px] transition-colors ${filter === f.id ? 'bg-ink/[0.07] font-medium text-ink' : 'text-ink/80 hover:bg-raised'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {searching ? (
          <div className="relative">
            <input
              ref={searchInput}
              className="input w-56 pl-8"
              placeholder="Search guides"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && (setQuery(''), setSearching(false))}
              onBlur={() => !query && setSearching(false)}
              aria-label="Search guides"
            />
            <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </div>
        ) : (
          <button className="icon-btn h-9 w-9" onClick={() => setSearching(true)} title="Search" aria-label="Search">
            <Icon name="search" />
          </button>
        )}
        <div className="relative">
          <button className="icon-btn h-9 w-9" onClick={() => setSortOpen((o) => !o)} title="Sort" aria-label="Sort" aria-expanded={sortOpen}>
            <Icon name="sort" />
          </button>
          {sortOpen && (
            <div className="menu right-0" role="menu" onMouseLeave={() => setSortOpen(false)}>
              {SORTS.map((o) => (
                <button
                  key={o.id}
                  role="menuitemradio"
                  aria-checked={sort === o.id}
                  className="menu-item"
                  onClick={() => {
                    setSort(o.id)
                    remember('library.sort', o.id)
                    setSortOpen(false)
                  }}
                >
                  <span className="w-4">{sort === o.id && <Icon name="check" className="h-4 w-4 text-accent" />}</span>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="icon-btn h-9 w-9"
          onClick={() => {
            const next = view === 'grid' ? 'list' : 'grid'
            setView(next)
            remember('library.view', next)
          }}
          title={view === 'grid' ? 'Show as a list' : 'Show as cards'}
          aria-label={view === 'grid' ? 'Show as a list' : 'Show as cards'}
        >
          <Icon name={view === 'grid' ? 'list' : 'grid'} />
        </button>
      </div>

      <section className="mb-12" aria-labelledby="make-new">
        <div className="mb-3 flex items-baseline gap-3">
          <h2 id="make-new" className="text-[15px] text-muted">
            Make something new
          </h2>
          <button className="ml-auto text-sm text-muted hover:text-ink" onClick={() => fileInput.current?.click()}>
            <Icon name="upload" className="mr-1 inline h-4 w-4" />
            Import
          </button>
          <button
            className="text-sm text-muted hover:text-ink"
            onClick={async () => {
              const g = await createSampleGuide()
              location.hash = `#/guide/${g.id}`
            }}
          >
            Open a sample
          </button>
        </div>
        <div className="grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          {tiles.map((t) => {
            const tone = toneFor(t.id)
            const busy = starting === t.id
            return (
              <button
                key={t.id}
                className="group text-left disabled:opacity-60"
                disabled={!!starting}
                onClick={() => (t.id === 'blank' ? void newGuide() : void capture(t.id))}
              >
                <span className="relative grid aspect-[16/11] place-items-center overflow-hidden rounded-2xl transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-soft" style={{ background: tone.bg }}>
                  <Scribble color={tone.ink} />
                  <span className="relative" style={{ color: tone.ink }}>
                    <Icon name={busy ? 'record' : tone.icon} className={`h-14 w-14 ${busy ? 'animate-pulse' : ''}`} />
                  </span>
                </span>
                <span className="mt-2 block px-1 text-[15px] font-medium">{tone.label}</span>
                <span className="block px-1 text-xs text-muted">{busy ? 'Starting…' : t.hint}</span>
              </button>
            )
          })}
        </div>
        {isExtension && (
          <p className="mt-3 text-xs text-muted">
            Capturing starts on the website you were last on. Finish from the StepCrumb icon or press <kbd className="rounded border border-line bg-raised px-1">Alt</kbd>+<kbd className="rounded border border-line bg-raised px-1">Shift</kbd>+<kbd className="rounded border border-line bg-raised px-1">R</kbd>.
          </p>
        )}
      </section>

      {guides === null ? (
        <p className="text-muted">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-16 text-center text-muted">
          {guides.length === 0 ? 'No guides yet. Pick one of the options above to make your first.' : 'Nothing matches.'}
        </div>
      ) : view === 'grid' ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((g) => {
            const tone = TONE[kindOf(g)]
            const thumb = thumbs[g.id]
            return (
              <div key={g.id} className="group relative overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-soft">
                <a href={href(g)} className="block" aria-label={g.title}>
                  <div className="relative h-48 overflow-hidden" style={{ background: tone.bg }}>
                    <Scribble color={tone.ink} />
                    {/* A sheet of the guide with another behind it, rising from the bottom. */}
                    <div className="absolute inset-x-[14%] bottom-0 top-9 translate-x-2 -translate-y-1 rounded-t-xl border border-black/5 bg-white/70" />
                    <div className="absolute inset-x-[12%] bottom-0 top-8 overflow-hidden rounded-t-xl border border-black/5 bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.35)] transition-transform duration-300 group-hover:-translate-y-1">
                      {thumb ? (
                        <img src={thumb} alt="" className="h-full w-full object-cover object-top" />
                      ) : (
                        <div className="space-y-2 p-4">
                          <div className="h-3 w-2/3 rounded bg-slate-200" />
                          <div className="h-2 w-full rounded bg-slate-100" />
                          <div className="h-2 w-5/6 rounded bg-slate-100" />
                          <div className="h-2 w-4/6 rounded bg-slate-100" />
                        </div>
                      )}
                      {kindOf(g) !== 'guide' && (
                        <span className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white">
                          <Icon name="play" className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 border-t border-line p-4">
                    <span className="grid h-10 w-10 flex-none place-items-center rounded-xl" style={{ background: tone.bg, color: tone.ink }}>
                      <Icon name={tone.icon} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium">{g.title}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                        {g.status === 'recording' && <span className="h-2 w-2 animate-pulse rounded-full bg-rec" />}
                        {meta(g)}
                      </span>
                    </span>
                  </div>
                </a>
                <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  {isExtension && canGuideMe(g) && (
                    <button
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-surface/95 px-2.5 text-xs font-semibold text-ink shadow-sm hover:bg-surface"
                      onClick={async () => {
                        const err = await startGuideMe(g.id)
                        if (err) setToast({ text: err, tone: 'error' })
                      }}
                      title="Play this guide on the real website"
                      aria-label={`Guide me: ${g.title}`}
                    >
                      <Icon name="play" className="h-3.5 w-3.5" /> Guide me
                    </button>
                  )}
                  <button className="icon-btn bg-surface/90 shadow-sm hover:!text-rec" onClick={() => remove(g)} title="Delete guide" aria-label={`Delete ${g.title}`}>
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {shown.map((g, i) => {
            const tone = TONE[kindOf(g)]
            const n = g.steps.filter((s) => s.kind === 'step').length
            return (
              <div key={g.id} className={`group flex items-center gap-3 px-4 py-3 hover:bg-raised/60 ${i ? 'border-t border-line' : ''}`}>
                <a href={href(g)} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-lg" style={{ background: tone.bg, color: tone.ink }}>
                    <Icon name={tone.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{g.title}</span>
                  <span className="hidden w-32 text-sm text-muted sm:block">{tone.label}</span>
                  <span className="hidden w-20 text-sm text-muted md:block">{kindOf(g) === 'video' ? '–' : `${n} step${n === 1 ? '' : 's'}`}</span>
                  <span className="w-36 text-right text-sm text-muted">{meta(g)}</span>
                </a>
                <button className="icon-btn opacity-0 focus:opacity-100 group-hover:opacity-100 hover:!text-rec" onClick={() => remove(g)} title="Delete guide" aria-label={`Delete ${g.title}`}>
                  <Icon name="trash" />
                </button>
              </div>
            )
          })}
        </div>
      )}
      <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = '' }} />
      {settings && <SettingsDialog onClose={() => setSettings(false)} />}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  )
}
