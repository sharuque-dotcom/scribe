import { count } from '../../shared/telemetry'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadSettings, polishSteps } from '../../shared/ai'
import { AI_ENABLED } from '../../shared/features'
import { deleteImage, putImage } from '../../shared/db'
import { download, guideBodyHtml, guideJson, guideMarkdown, printHtml, renderAll, slug, wrapHtml, type Rendered } from '../../shared/export'
import { stepNumbers } from '../../shared/templates'
import { guideViews, type StepView } from '../../shared/zoom'
import type { DocKind, Step, StepKind } from '../../shared/types'
import { uid } from '../../shared/types'
import { Dropdown, Icon, isExtension, Modal, timeAgo, Toast, type ToastData, AutoText } from '../ui'
import { useGuide } from '../useGuide'
import { canGuideMe, checkGuide, startGuideMe } from '../guideMe'
import { healthSummary } from '../../shared/guideme'
import { Annotator, type Tool } from './Annotator'
import { DocView } from './DocView'
import { openSettings } from '../actions'
import { exportFeature, FEATURES } from '../../shared/plans'
import { usePlan } from '../usePlan'
import { lockedToast } from '../upgrade'
import { guideDocx, toBlob } from '../../shared/docx'
import { StepCard } from './StepCard'
import { VideoView } from './VideoView'

export type Tab = 'steps' | 'preview' | DocKind | 'video'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'steps', label: 'Steps', icon: 'list' },
  { id: 'preview', label: 'Preview', icon: 'eye' },
  { id: 'sop', label: 'SOP', icon: 'doc' },
  { id: 'training', label: 'Training', icon: 'cap' },
  { id: 'video', label: 'Video', icon: 'video' },
]

function newStep(kind: StepKind): Step {
  return { id: uid(), kind, title: '', annotations: [], createdAt: Date.now(), noteStyle: kind === 'note' ? 'tip' : undefined, action: kind === 'step' ? 'manual' : undefined }
}

async function fileToImage(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = dataUrl
  })
  return { id: uid(), dataUrl, w: img.naturalWidth, h: img.naturalHeight }
}

export function Workspace({ id, tab }: { id: string; tab: Tab }) {
  const { guide, images, update, addImage } = useGuide(id)
  const { can } = usePlan()
  const branded = !can('pdfNoBranding')
  const [annotating, setAnnotating] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastData | null>(null)
  const [polishing, setPolishing] = useState(false)
  const [rendered, setRendered] = useState<Rendered | null>(null)
  const orphanImage = useRef<string | null>(null)
  const uploadFor = useRef<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const readOnly = guide?.status === 'recording'
  const nums = useMemo(() => (guide ? stepNumbers(guide) : new Map<string, number>()), [guide])
  const views = useMemo(() => (guide ? guideViews(guide, images) : new Map<string, StepView>()), [guide, images])
  const [annotTool, setAnnotTool] = useState<Tool>('box')
  const [checking, setChecking] = useState(false)
  const [sharing, setSharing] = useState(false)
  const health = guide ? healthSummary(guide) : null
  // Just imported from a shared file: say what to do with it.
  const [imported, setImported] = useState(() => {
    try {
      return sessionStorage.getItem('stepcrumb.imported') === id
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      if (sessionStorage.getItem('stepcrumb.imported') === id) sessionStorage.removeItem('stepcrumb.imported')
    } catch {
      // Nothing to clear.
    }
  }, [id])
  const shotCount = guide ? guide.steps.filter((s) => s.imageId).length : 0
  const blurCount = guide ? guide.steps.reduce((n, s) => n + s.annotations.filter((a) => a.type === 'blur').length, 0) : 0

  // The step nearest the middle of the screen, for the Contents rail.
  const [inView, setInView] = useState<string | null>(null)
  useEffect(() => {
    if (tab !== 'steps') return
    const on = () => {
      const mid = innerHeight / 2
      let best: string | null = null
      let bestD = Infinity
      document.querySelectorAll<HTMLElement>('[id^="step-"]').forEach((el) => {
        const r = el.getBoundingClientRect()
        const d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid))
        if (d < bestD) {
          bestD = d
          best = el.id.slice(5)
        }
      })
      setInView(best)
    }
    on()
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [tab, guide?.steps.length])

  // Flattened screenshots are needed by the preview, documents and exports.
  useEffect(() => {
    if (!guide || tab === 'steps' || tab === 'video') return
    let live = true
    const t = window.setTimeout(() => {
      renderAll(guide, images).then((r) => live && setRendered(r))
    }, 150)
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [guide, images, tab])

  const dismissToast = useCallback(() => {
    setToast(null)
    if (orphanImage.current) {
      void deleteImage(orphanImage.current)
      orphanImage.current = null
    }
  }, [])

  if (guide === undefined) return <div className="p-10 text-center text-muted">Loading…</div>
  if (guide === null)
    return (
      <div className="p-10 text-center">
        <p className="mb-4 text-muted">This guide no longer exists.</p>
        <a className="btn-secondary" href="#/">
          Back to library
        </a>
      </div>
    )

  const patchStep = (stepId: string, patch: Partial<Step>) => update((g) => ({ ...g, steps: g.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) }))

  const moveStep = (idx: number, dir: -1 | 1) =>
    update((g) => {
      const steps = [...g.steps]
      const j = idx + dir
      if (j < 0 || j >= steps.length) return g
      ;[steps[idx], steps[j]] = [steps[j], steps[idx]]
      return { ...g, steps }
    })

  const deleteStep = (idx: number) => {
    const removed = guide.steps[idx]
    if (orphanImage.current) void deleteImage(orphanImage.current)
    orphanImage.current = removed.imageId ?? null
    update((g) => ({ ...g, steps: g.steps.filter((s) => s.id !== removed.id) }))
    setToast({
      text: removed.kind === 'step' ? 'Step deleted' : 'Deleted',
      action: {
        label: 'Undo',
        run: () => {
          orphanImage.current = null
          update((g) => {
            const steps = [...g.steps]
            steps.splice(Math.min(idx, steps.length), 0, removed)
            return { ...g, steps }
          })
        },
      },
    })
  }

  const insertAt = (idx: number, kind: StepKind) => {
    const s = newStep(kind)
    update((g) => {
      const steps = [...g.steps]
      steps.splice(idx, 0, s)
      return { ...g, steps }
    })
    setTimeout(() => document.querySelector<HTMLTextAreaElement>(`#step-${s.id} textarea`)?.focus(), 50)
  }

  const onFile = async (file: File | undefined) => {
    const stepId = uploadFor.current
    if (!file || !stepId) return
    try {
      const img = await fileToImage(file)
      await putImage(img)
      addImage(img)
      patchStep(stepId, { imageId: img.id, annotations: [], crop: undefined, targetRect: undefined, click: undefined })
    } catch {
      setToast({ text: 'That file could not be read as an image.', tone: 'error' })
    }
  }

  const polish = async () => {
    const settings = loadSettings()
    if (!settings.apiKey) {
      openSettings()
      return
    }
    setPolishing(true)
    try {
      const r = await renderAll(guide, images, 1200, { full: true })
      const result = await polishSteps(guide, r, settings)
      const before = guide
      const byNumber = new Map(result.steps.map((s) => [s.number, s]))
      update((g) => {
        const n = stepNumbers(g)
        return {
          ...g,
          title: result.title || g.title,
          description: result.description || g.description,
          steps: g.steps.map((s) => {
            const p = byNumber.get(n.get(s.id) ?? -1)
            return p ? { ...s, title: p.title || s.title, detail: p.detail || s.detail } : s
          }),
        }
      })
      setToast({ text: `Claude rewrote ${result.steps.length} steps`, action: { label: 'Undo', run: () => update(() => before) } })
    } catch (err) {
      setToast({ text: (err as Error).message, tone: 'error' })
    } finally {
      setPolishing(false)
    }
  }

  const exportGuide = async (format: 'pdf' | 'docx' | 'html' | 'md' | 'json') => {
    const name = slug(guide.title)
    if (format === 'json') count('export_json')
    if (format === 'json') return download(`${name}.stepcrumb.json`, await guideJson(guide), 'application/json')
    const needs = exportFeature(format)
    if (needs && !can(needs)) return setToast(lockedToast(FEATURES[needs].label))
    count(`export_${format}`)
    const r = await renderAll(guide, images)
    if (format === 'docx') return download(`${name}.docx`, await toBlob(await guideDocx(guide, r)))
    if (format === 'md') return download(`${name}.md`, guideMarkdown(guide, r), 'text/markdown')
    const html = wrapHtml(guide.title, guideBodyHtml(guide, r), { branded })
    if (format === 'html') download(`${name}.html`, html, 'text/html')
    else printHtml(html)
  }

  const annotStep = guide.steps.find((s) => s.id === annotating)
  const annotImage = annotStep?.imageId ? images[annotStep.imageId] : undefined

  const insertBar = (at: number) =>
    readOnly ? null : (
      <div className="group/ins relative flex h-6 items-center justify-center">
        <div className="absolute inset-x-8 top-1/2 h-px bg-line opacity-0 transition-opacity group-hover/ins:opacity-100" />
        <div className="relative flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/ins:opacity-100">
          {(
            [
              ['step', 'Step'],
              ['note', 'Tip / note'],
              ['heading', 'Heading'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-muted shadow-sm hover:text-accent" onClick={() => insertAt(at, k)}>
              + {l}
            </button>
          ))}
        </div>
      </div>
    )

  return (
    <div className="min-h-screen">
      {/* Header: where you are, the guide's name, its views, and the two main actions. */}
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-5 pt-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <nav className="mb-0.5 flex items-center gap-1.5 text-[13px] text-muted" aria-label="Breadcrumb">
                <a href="#/" className="hover:text-ink">
                  Library
                </a>
                <span aria-hidden>›</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: guide.mode === 'video' && guide.video ? '#7c3aed' : guide.video ? '#ea580c' : '#2563eb' }} />
                  {guide.mode === 'video' && guide.video ? 'Video' : guide.video ? 'Guide + video' : 'Guide'}
                </span>
                <span aria-hidden>·</span>
                <span>Edited {timeAgo(guide.updatedAt)}</span>
              </nav>
              <input
                className="-ml-2 w-full min-w-0 truncate rounded-lg bg-transparent px-2 py-0.5 text-[22px] font-semibold tracking-[-0.01em] outline-none hover:bg-ink/[0.04] focus:bg-surface focus:ring-2 focus:ring-accent/20"
                value={guide.title}
                onChange={(e) => update((g) => ({ ...g, title: e.target.value }))}
                aria-label="Guide title"
              />
            </div>
            {isExtension && canGuideMe(guide) && (
              <div className="flex">
                <button
                  className="btn-secondary rounded-l-xl rounded-r-none"
                  title="Play this guide on the real website, step by step"
                  onClick={async () => {
                    const err = await startGuideMe(guide.id)
                    if (err) setToast({ text: err, tone: 'error' })
                  }}
                >
                  <Icon name="play" /> Guide me
                </button>
                <Dropdown label="" icon="chevron" buttonClass="btn-secondary -ml-px h-full rounded-l-none rounded-r-xl px-2" ariaLabel="Guide me options">
                  {(close) => (
                    <div className="w-72">
                      <button
                        className="menu-item items-start"
                        onClick={async () => {
                          close()
                          const err = await startGuideMe(guide.id, { practice: true })
                          if (err) setToast({ text: err, tone: 'error' })
                        }}
                      >
                        <Icon name="cap" />
                        <span>
                          <span className="block font-medium">Practice</span>
                          <span className="block text-xs text-muted">Play it with Save, Submit, Pay and similar buttons stopped, so nothing is changed.</span>
                        </span>
                      </button>
                      <button
                        className="menu-item items-start"
                        disabled={checking}
                        onClick={async () => {
                          close()
                          setChecking(true)
                          const err = await checkGuide(guide.id)
                          setChecking(false)
                          setToast(err ? { text: err, tone: 'error' } : { text: 'Checked. The result is at the top of the steps.' })
                        }}
                      >
                        <Icon name="check" />
                        <span>
                          <span className="block font-medium">Check this guide</span>
                          <span className="block text-xs text-muted">Opens each page in the background and looks for every button and field. Nothing is clicked.</span>
                        </span>
                      </button>
                      <button
                        className="menu-item items-start"
                        onClick={() => {
                          close()
                          setSharing(true)
                        }}
                      >
                        <Icon name="upload" />
                        <span>
                          <span className="block font-medium">Share for Guide me</span>
                          <span className="block text-xs text-muted">Send a teammate a file they can play. No account or IT needed.</span>
                        </span>
                      </button>
                    </div>
                  )}
                </Dropdown>
              </div>
            )}
            {(tab === 'steps' || tab === 'preview') && (
              <Dropdown label="Export" icon="download" buttonClass="btn-primary rounded-xl">
                {(close) =>
                  (
                    [
                      ['pdf', branded ? 'PDF (with StepCrumb footer)' : 'PDF (print / save as PDF)'],
                      ['docx', 'Word (.docx)'],
                      ['html', 'HTML page'],
                      ['md', 'Markdown (.md)'],
                      ['json', 'StepCrumb file (share for Guide me, or backup)'],
                    ] as const
                  ).map(([f, label]) => (
                    <button
                      key={f}
                      className="menu-item"
                      onClick={() => {
                        close()
                        void exportGuide(f)
                      }}
                    >
                      {label}
                      {exportFeature(f) && !can(exportFeature(f)!) && <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800" title="StepCrumb Pro">Pro</span>}
                    </button>
                  ))
                }
              </Dropdown>
            )}
          </div>
          <nav className="-mb-px mt-3 flex gap-1 overflow-x-auto" aria-label="Views">
            {TABS.map((t) => (
              <a
                key={t.id}
                href={`#/guide/${guide.id}${t.id === 'steps' ? '' : '/' + t.id}`}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`flex flex-none items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors ${tab === t.id ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}
              >
                <Icon name={t.icon} />
                {t.label}
                {t.id === 'video' && guide.video && <span className="h-1.5 w-1.5 rounded-full bg-ember" title="This guide has a video" />}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {readOnly && (
        <div className="border-b border-rec/20 bg-rec/5 px-4 py-2 text-center text-sm text-rec">
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-rec align-middle" />
          Still capturing. New steps appear here as you click. Press <strong>Finish</strong> on the page to start editing.
        </div>
      )}

      {tab === 'steps' && (
        <div className="mx-auto flex max-w-6xl gap-10 px-5 pt-8 sm:px-8">
          {/* Contents: follows the step you're looking at. */}
          <aside className="sticky top-36 hidden h-[calc(100vh-10rem)] w-56 flex-none overflow-auto xl:block">
            <p className="mb-3 px-2 text-xs font-medium text-muted">Contents</p>
            <ol className="relative space-y-0.5 text-[13px]">
              <span className="absolute bottom-3 left-[19px] top-3 w-px border-l border-dashed border-ink/15" aria-hidden />
              {guide.steps.map((s) => {
                const on = s.id === inView
                return (
                  <li key={s.id} className="relative">
                    <a
                      href={`#/guide/${guide.id}`}
                      onClick={(e) => {
                        e.preventDefault()
                        document.getElementById(`step-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }}
                      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${on ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(21_20_18/0.06)]' : 'text-muted hover:text-ink'} ${s.kind === 'heading' ? 'mt-3 font-semibold text-ink' : ''}`}
                    >
                      {s.kind === 'step' ? (
                        <span className={`relative grid h-[22px] w-[22px] flex-none place-items-center rounded-full text-[11px] font-semibold tabular-nums ${on ? 'bg-ember text-white' : 'bg-surface text-ink ring-1 ring-line'}`}>{nums.get(s.id)}</span>
                      ) : (
                        <span className="relative grid h-[22px] w-[22px] flex-none place-items-center">
                          <span className={`h-1.5 w-1.5 rounded-full ${s.kind === 'heading' ? 'bg-ink' : 'bg-accent'}`} />
                        </span>
                      )}
                      <span className="truncate">{s.title || 'Untitled'}</span>
                    </a>
                  </li>
                )
              })}
            </ol>
          </aside>

          <main className="min-w-0 flex-1 pb-32">
            <div className="mb-4 flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <AutoText value={guide.description} onChange={(description) => update((g) => ({ ...g, description }))} placeholder="Add a short description of what this guide is for…" ariaLabel="Guide description" className="text-[15px] text-muted" />
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {[
                    [`${nums.size} step${nums.size === 1 ? '' : 's'}`, 'list'],
                    [`${shotCount} screenshot${shotCount === 1 ? '' : 's'}`, 'image'],
                    ...(blurCount ? [[`${blurCount} blurred`, 'blur']] : []),
                    ...(guide.video ? [['Video', 'video']] : []),
                  ].map(([t, icon]) => (
                    <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-muted">
                      <Icon name={icon} className="h-3.5 w-3.5" />
                      {t}
                    </span>
                  ))}
                  {health && health.total > 0 && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${health.missed ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-green-300 bg-green-50 text-green-800'}`}
                      title={`${health.source === 'check' ? 'Checked' : 'Played with Guide me'} ${timeAgo(health.at)}${health.unchecked ? `. ${health.unchecked} step${health.unchecked === 1 ? '' : 's'} could only be checked by playing it.` : ''}`}
                    >
                      <Icon name="play" className="h-3.5 w-3.5" />
                      Guide me: {health.ok} of {health.total} steps OK
                    </span>
                  )}
                  {checking && <span className="self-center px-1 text-muted">Checking the guide on the live pages…</span>}
                  {!readOnly && nums.size > 0 && <span className="self-center px-1 text-muted">Click a screenshot to annotate it</span>}
                </div>
                {imported && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm" role="status">
                    <Icon name="play" className="h-4 w-4 flex-none text-accent" />
                    <span className="flex-1">Imported. Press <b>Guide me</b> to be walked through it on the website, or choose <b>Practice</b> from its menu to try it without changing anything.</span>
                    <button className="font-semibold underline underline-offset-2" onClick={() => setImported(false)}>
                      Got it
                    </button>
                  </div>
                )}
                {guide.repaired && guide.repaired.stepIds.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900" role="status">
                    <Icon name="check" className="h-4 w-4 flex-none" />
                    <span className="flex-1">
                      Guide me repaired {guide.repaired.stepIds.length} step{guide.repaired.stepIds.length === 1 ? '' : 's'} after the app changed. They're marked below.
                    </span>
                    <button className="font-semibold underline underline-offset-2" onClick={() => update((g) => ({ ...g, repaired: undefined }))}>
                      Got it
                    </button>
                  </div>
                )}
              </div>
              {!readOnly && nums.size > 0 && (
                <Dropdown label="Screenshots" icon="image">
                  {(close) => (
                    <div className="w-72 p-2 text-sm">
                      <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted">Zoom</p>
                      {(
                        [
                          ['auto', 'Auto', 'Full screen for the first step on each page, then zoom in on what was clicked'],
                          ['always', 'Always zoom', 'Zoom in on every click, even the first on a page'],
                          ['full', 'Always full screen', 'Never zoom'],
                        ] as const
                      ).map(([m, l, d]) => (
                        <label key={m} className="flex cursor-pointer gap-2 rounded-md px-1 py-1.5 hover:bg-raised">
                          <input type="radio" name="zoomMode" className="mt-1" checked={(guide.zoomMode ?? 'auto') === m} onChange={() => update((g) => ({ ...g, zoomMode: m }))} />
                          <span>
                            <span className="block font-medium">{l}</span>
                            <span className="block text-xs text-muted">{d}</span>
                          </span>
                        </label>
                      ))}
                      <label className="mt-1 flex cursor-pointer gap-2 border-t border-line px-1 pb-1 pt-2.5">
                        <input type="checkbox" className="mt-1" checked={guide.zoomInset !== false} onChange={(e) => update((g) => ({ ...g, zoomInset: e.target.checked }))} />
                        <span>
                          <span className="block font-medium">Page thumbnail on zoomed images</span>
                          <span className="block text-xs text-muted">A small view of the whole page in the corner</span>
                        </span>
                      </label>
                      <button
                        className="menu-item mt-1 border-t border-line text-muted"
                        onClick={() => {
                          close()
                          const before = guide
                          update((g) => ({ ...g, steps: g.steps.map((s) => ({ ...s, crop: undefined, zoom: undefined })) }))
                          setToast({ text: 'All screenshots now follow the zoom setting', action: { label: 'Undo', run: () => update(() => before) } })
                        }}
                      >
                        Reset every step to this setting
                      </button>
                    </div>
                  )}
                </Dropdown>
              )}
              {AI_ENABLED && !readOnly && (
                <button className="btn-secondary" onClick={polish} disabled={polishing || !nums.size}>
                  <Icon name="sparkle" /> {polishing ? 'Improving…' : 'Improve steps with Claude'}
                </button>
              )}
            </div>

            {guide.steps.length === 0 && (
              <div className="card mb-4 p-10 text-center text-sm text-muted">
                No steps yet. Capture a workflow with the extension, or add steps by hand below.
              </div>
            )}

            {insertBar(0)}
            {guide.steps.map((s, i) => (
              <div key={s.id}>
                <StepCard
                  step={s}
                  number={nums.get(s.id)}
                  image={s.imageId ? images[s.imageId] : undefined}
                  first={i === 0}
                  last={i === guide.steps.length - 1}
                  readOnly={readOnly}
                  onChange={(p) => patchStep(s.id, p)}
                  onMove={(d) => moveStep(i, d)}
                  onDelete={() => deleteStep(i)}
                  view={views.get(s.id)}
                  onAnnotate={() => {
                    setAnnotTool('box')
                    setAnnotating(s.id)
                  }}
                  onAdjustZoom={() => {
                    setAnnotTool('crop')
                    setAnnotating(s.id)
                  }}
                  health={guide.repaired?.stepIds.includes(s.id) ? 'repaired' : guide.health?.results[s.id] === 'missed' ? 'missed' : undefined}
                />
                {s.kind === 'step' && !s.imageId && !readOnly && (
                  <button
                    className="-mt-2 mb-1 ml-14 text-xs font-medium text-muted hover:text-accent"
                    onClick={() => {
                      uploadFor.current = s.id
                      fileInput.current?.click()
                    }}
                  >
                    + Add screenshot
                  </button>
                )}
                {insertBar(i + 1)}
              </div>
            ))}
            <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
          </main>
        </div>
      )}

      {tab === 'preview' && (
        <div className="mx-auto max-w-4xl px-4 pb-24 pt-6">
          {rendered ? (
            <iframe title="Guide preview" className="h-[calc(100vh-8rem)] w-full rounded-xl border border-line bg-white shadow-soft" srcDoc={wrapHtml(guide.title, guideBodyHtml(guide, rendered), { branded })} />
          ) : (
            <p className="text-center text-muted">Rendering…</p>
          )}
        </div>
      )}

      {(tab === 'sop' || tab === 'training') && (
        <DocView
          key={tab}
          kind={tab}
          guide={guide}
          rendered={rendered}
          onSave={(markdown, source) => update((g) => ({ ...g, docs: { ...g.docs, [tab]: { kind: tab, markdown, source, updatedAt: Date.now() } } }))}
          needKey={() => openSettings()}
          renderForAi={() => renderAll(guide, images, 1400, { full: true })}
          toast={setToast}
          onAnnotate={(id) => {
            setAnnotTool('box')
            setAnnotating(id)
          }}
        />
      )}

      {tab === 'video' && <VideoView guide={guide} update={update} toast={setToast} />}

      {annotStep && annotImage && (
        <Annotator
          step={annotStep}
          image={annotImage}
          initialTool={annotTool}
          autoZoom={views.get(annotStep.id)?.crop}
          onCancel={() => setAnnotating(null)}
          onSave={(r) => {
            patchStep(annotStep.id, r)
            setAnnotating(null)
          }}
        />
      )}
      {sharing && (
        <Modal title="Share for Guide me" onClose={() => setSharing(false)}>
          <div className="space-y-4 text-sm">
            <p>Send this file to a teammate (by email, Teams, Slack or a shared drive). They don't need an account, and nothing is installed for them except StepCrumb.</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-muted">
              <li>They open StepCrumb's library and drop the file on it (or click Import).</li>
              <li>The guide opens. They press <b className="text-ink">Guide me</b>, or <b className="text-ink">Practice</b> to try it without changing anything.</li>
            </ol>
            <p className="text-xs text-muted">The file includes the steps and the screenshots. Passwords are blurred for good, but other blurs travel as edits the person could remove, so don't share screenshots that show anything they shouldn't see.</p>
            <button
              className="btn-primary w-full rounded-xl"
              onClick={async () => {
                await exportGuide('json')
                setSharing(false)
              }}
            >
              <Icon name="download" /> Download the file
            </button>
          </div>
        </Modal>
      )}
      <Toast toast={toast} onDone={dismissToast} />
    </div>
  )
}
