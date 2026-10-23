import { useEffect, useRef, useState } from 'react'
import { deleteGuide, getImage, listGuides, putGuide } from '../../shared/db'
import { importGuideJson } from '../../shared/export'
import { renderStep } from '../../shared/render'
import type { Guide } from '../../shared/types'
import { uid } from '../../shared/types'
import { createSampleGuide } from '../sample'
import { Icon, isExtension, timeAgo, Toast, type ToastData } from '../ui'

export function Library() {
  const [guides, setGuides] = useState<Guide[] | null>(null)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<ToastData | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

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
      const first = g.steps.find((s) => s.imageId)
      if (!first || thumbs[g.id]) continue
      getImage(first.imageId!).then((img) => img && renderStep(first, img, { maxWidth: 480 }).then((src) => setThumbs((t) => ({ ...t, [g.id]: src }))))
    }
  }, [guides, thumbs])

  const newGuide = async () => {
    const now = Date.now()
    const g: Guide = { id: uid(), title: 'Untitled guide', description: '', createdAt: now, updatedAt: now, status: 'ready', steps: [], docs: {} }
    await putGuide(g)
    location.hash = `#/guide/${g.id}`
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

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-8">
      <header className="mb-8 flex flex-wrap items-center gap-3">
        <div className="mr-auto flex items-center gap-3">
          <img src="./icons/icon48.png" alt="" className="h-9 w-9" />
          <div>
            <h1 className="text-xl font-bold">Scribe</h1>
            <p className="text-sm text-muted">Step-by-step guides, SOPs and training, captured as you click.</p>
          </div>
        </div>
        <button className="btn-secondary" onClick={() => fileInput.current?.click()}>
          <Icon name="upload" /> Import
        </button>
        <button className="btn-secondary" onClick={newGuide}>
          <Icon name="plus" /> Blank guide
        </button>
        <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = '' }} />
      </header>

      <section className="card mb-8 flex flex-wrap items-center gap-5 p-5">
        <div className="grid h-11 w-11 flex-none place-items-center rounded-full bg-rec/10 text-rec">
          <Icon name="record" className="h-5 w-5" />
        </div>
        <div className="min-w-[240px] flex-1 text-sm">
          {isExtension ? (
            <>
              <p className="font-semibold">Capture a new guide</p>
              <p className="text-muted">
                Go to the site you want to document, click the Scribe icon in the toolbar and press <strong>Start capturing</strong> (or press <kbd className="rounded border border-line bg-raised px-1">Alt</kbd>+<kbd className="rounded border border-line bg-raised px-1">Shift</kbd>+<kbd className="rounded border border-line bg-raised px-1">R</kbd>). Click through the task, then press <strong>Finish</strong>.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">Capturing needs the browser extension</p>
              <p className="text-muted">Load the built <code>dist/</code> folder as an unpacked extension in Chrome or Edge. You can still try the editor with the sample guide.</p>
            </>
          )}
        </div>
        <button
          className="btn-secondary"
          onClick={async () => {
            const g = await createSampleGuide()
            location.hash = `#/guide/${g.id}`
          }}
        >
          Open a sample guide
        </button>
      </section>

      {guides === null ? (
        <p className="text-muted">Loading…</p>
      ) : guides.length === 0 ? (
        <p className="py-16 text-center text-muted">No guides yet.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => {
            const n = g.steps.filter((s) => s.kind === 'step').length
            return (
              <div key={g.id} className="card group relative overflow-hidden">
                <a href={`#/guide/${g.id}`} className="block">
                  <div className="aspect-[16/9] overflow-hidden border-b border-line bg-raised">
                    {thumbs[g.id] ? <img src={thumbs[g.id]} alt="" className="h-full w-full object-cover object-top" /> : <div className="grid h-full place-items-center text-muted"><Icon name="image" className="h-8 w-8" /></div>}
                  </div>
                  <div className="p-4">
                    <p className="line-clamp-2 font-semibold">{g.title}</p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                      {g.status === 'recording' && <span className="rounded bg-rec/10 px-1.5 py-0.5 font-semibold text-rec">Capturing</span>}
                      {n} step{n === 1 ? '' : 's'} · {timeAgo(g.updatedAt)}
                      {g.docs.sop && <span className="rounded bg-raised px-1.5 py-0.5">SOP</span>}
                      {g.docs.training && <span className="rounded bg-raised px-1.5 py-0.5">Training</span>}
                    </p>
                  </div>
                </a>
                <button className="icon-btn absolute right-2 top-2 bg-surface/90 opacity-0 shadow-sm group-hover:opacity-100 hover:!text-rec" onClick={() => remove(g)} title="Delete guide" aria-label={`Delete ${g.title}`}>
                  <Icon name="trash" />
                </button>
              </div>
            )
          })}
        </div>
      )}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  )
}
