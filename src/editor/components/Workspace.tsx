import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadSettings, polishSteps } from '../../shared/ai'
import { deleteImage, putImage } from '../../shared/db'
import { download, guideBodyHtml, guideJson, guideMarkdown, printHtml, renderAll, slug, wrapHtml, type Rendered } from '../../shared/export'
import { stepNumbers } from '../../shared/templates'
import { guideViews, type StepView } from '../../shared/zoom'
import type { DocKind, Step, StepKind } from '../../shared/types'
import { uid } from '../../shared/types'
import { Dropdown, Icon, Toast, type ToastData, AutoText } from '../ui'
import { useGuide } from '../useGuide'
import { Annotator, type Tool } from './Annotator'
import { DocView } from './DocView'
import { SettingsDialog } from './Settings'
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
  const [annotating, setAnnotating] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastData | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [rendered, setRendered] = useState<Rendered | null>(null)
  const orphanImage = useRef<string | null>(null)
  const uploadFor = useRef<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const readOnly = guide?.status === 'recording'
  const nums = useMemo(() => (guide ? stepNumbers(guide) : new Map<string, number>()), [guide])
  const views = useMemo(() => (guide ? guideViews(guide, images) : new Map<string, StepView>()), [guide, images])
  const [annotTool, setAnnotTool] = useState<Tool>('box')

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
      setSettingsOpen(true)
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

  const exportGuide = async (format: 'pdf' | 'html' | 'md' | 'json') => {
    const name = slug(guide.title)
    if (format === 'json') return download(`${name}.scribe.json`, await guideJson(guide), 'application/json')
    const r = await renderAll(guide, images)
    if (format === 'md') return download(`${name}.md`, guideMarkdown(guide, r), 'text/markdown')
    const html = wrapHtml(guide.title, guideBodyHtml(guide, r))
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
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <a href="#/" className="icon-btn" title="All guides" aria-label="All guides">
            <Icon name="back" />
          </a>
          <input
            className="min-w-0 flex-1 truncate rounded-md bg-transparent px-2 py-1 text-[15px] font-semibold outline-none hover:bg-raised focus:bg-raised"
            value={guide.title}
            onChange={(e) => update((g) => ({ ...g, title: e.target.value }))}
            aria-label="Guide title"
          />
          <nav className="hidden items-center gap-1 rounded-lg bg-raised p-1 md:flex">
            {TABS.map((t) => (
              <a
                key={t.id}
                href={`#/guide/${guide.id}${t.id === 'steps' ? '' : '/' + t.id}`}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
              >
                <Icon name={t.icon} />
                {t.label}
              </a>
            ))}
          </nav>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="AI settings" aria-label="AI settings">
            <Icon name="settings" />
          </button>
          {(tab === 'steps' || tab === 'preview') && (
            <Dropdown label="Export" icon="download">
              {(close) =>
                (
                  [
                    ['pdf', 'PDF (print / save as PDF)'],
                    ['html', 'HTML page'],
                    ['md', 'Markdown (.md)'],
                    ['json', 'Scribe file (.json backup)'],
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
                  </button>
                ))
              }
            </Dropdown>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {TABS.map((t) => (
            <a key={t.id} href={`#/guide/${guide.id}${t.id === 'steps' ? '' : '/' + t.id}`} className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.id ? 'bg-raised text-ink' : 'text-muted'}`}>
              {t.label}
            </a>
          ))}
        </nav>
      </header>

      {readOnly && (
        <div className="border-b border-rec/20 bg-rec/5 px-4 py-2 text-center text-sm text-rec">
          <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-rec align-middle" />
          Still capturing. New steps appear here as you click. Press <strong>Finish</strong> on the page to start editing.
        </div>
      )}

      {tab === 'steps' && (
        <div className="mx-auto flex max-w-6xl gap-8 px-4 pt-6">
          {/* Outline */}
          <aside className="sticky top-20 hidden h-[calc(100vh-6rem)] w-60 flex-none overflow-auto lg:block">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted">Outline</p>
            <ol className="space-y-0.5 text-sm">
              {guide.steps.map((s) => (
                <li key={s.id}>
                  <a href={`#/guide/${guide.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`step-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }} className={`flex gap-2 truncate rounded-md px-2 py-1 hover:bg-raised ${s.kind === 'heading' ? 'mt-2 font-semibold' : 'text-muted'}`}>
                    {s.kind === 'step' && <span className="w-5 flex-none text-right tabular-nums">{nums.get(s.id)}.</span>}
                    {s.kind === 'note' && <span className="w-5 flex-none text-right">•</span>}
                    <span className="truncate">{s.title || 'Untitled'}</span>
                  </a>
                </li>
              ))}
            </ol>
          </aside>

          <main className="min-w-0 flex-1 pb-32">
            <div className="mb-4 flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <AutoText value={guide.description} onChange={(description) => update((g) => ({ ...g, description }))} placeholder="Add a short description of what this guide is for…" ariaLabel="Guide description" className="text-[15px] text-muted" />
                <p className="mt-1 text-xs text-muted">
                  {nums.size} step{nums.size === 1 ? '' : 's'} · click a screenshot to annotate it
                </p>
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
              {!readOnly && (
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
            <iframe title="Guide preview" className="h-[calc(100vh-8rem)] w-full rounded-xl border border-line bg-white shadow-soft" srcDoc={wrapHtml(guide.title, guideBodyHtml(guide, rendered))} />
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
          needKey={() => setSettingsOpen(true)}
          renderForAi={() => renderAll(guide, images, 1400, { full: true })}
          toast={setToast}
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
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      <Toast toast={toast} onDone={dismissToast} />
    </div>
  )
}
