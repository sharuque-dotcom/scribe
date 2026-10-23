import { useEffect, useMemo, useRef, useState } from 'react'
import { loadSettings, writeDocument } from '../../shared/ai'
import { download, markdownToHtml, markdownWithImages, printHtml, shotsByNumber, slug, wrapHtml, type Rendered } from '../../shared/export'
import { buildSop, buildTraining } from '../../shared/templates'
import type { DocKind, Guide } from '../../shared/types'
import { Dropdown, Icon, type ToastData } from '../ui'

const LABELS: Record<DocKind, { name: string; blurb: string }> = {
  sop: {
    name: 'Standard Operating Procedure',
    blurb: 'A formal procedure with purpose, scope, prerequisites, numbered steps with screenshots, expected result and revision history.',
  },
  training: {
    name: 'Training module',
    blurb: 'A lesson with learning objectives, a guided walkthrough, a practice exercise, a short quiz with answers, and a quick-reference card.',
  },
}

interface Props {
  kind: DocKind
  guide: Guide
  rendered: Rendered | null
  onSave: (markdown: string, source: 'ai' | 'template') => void
  needKey: () => void
  // Full-screen screenshots for Claude, so it sees the whole page.
  renderForAi: () => Promise<Rendered>
  toast: (t: ToastData) => void
}

// Shows the document in an isolated frame, styled exactly like the export.
function DocFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(800)
  useEffect(() => {
    const f = ref.current
    if (!f) return
    const fit = () => {
      const h = f.contentDocument?.documentElement.scrollHeight
      if (h) setHeight(h + 8)
    }
    f.addEventListener('load', fit)
    const t = window.setInterval(fit, 700)
    return () => {
      f.removeEventListener('load', fit)
      window.clearInterval(t)
    }
  }, [])
  return <iframe ref={ref} title="Document preview" srcDoc={html} className="w-full rounded-xl border border-line bg-white shadow-soft" style={{ height }} />
}

export function DocView({ kind, guide, rendered, onSave, needKey, renderForAi, toast }: Props) {
  const doc = guide.docs[kind]
  const [editing, setEditing] = useState(false)
  const [streaming, setStreaming] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  const [throttled, setThrottled] = useState<string | null>(null)

  // Re-render the preview at most twice a second while text is streaming in.
  useEffect(() => {
    if (streaming === null) {
      setThrottled(null)
      return
    }
    const t = window.setTimeout(() => setThrottled(streaming), 500)
    return () => window.clearTimeout(t)
  }, [streaming])

  const markdown = streaming ?? doc?.markdown ?? ''
  const shots = useMemo(() => (rendered ? shotsByNumber(guide, rendered) : {}), [guide, rendered])
  const previewMd = streaming !== null ? (throttled ?? '') : markdown
  const html = useMemo(() => wrapHtml(guide.title, markdownToHtml(previewMd, shots)), [previewMd, shots, guide.title])

  const fromTemplate = () => {
    if (doc && !confirm('Replace the current document with a fresh template?')) return
    onSave(kind === 'sop' ? buildSop(guide) : buildTraining(guide), 'template')
  }

  const withAi = async () => {
    const settings = loadSettings()
    if (!settings.apiKey) return needKey()
    if (!rendered) return
    if (doc && !confirm('Replace the current document with a new one written by Claude?')) return
    const ctrl = new AbortController()
    abort.current = ctrl
    setStreaming('')
    setEditing(false)
    try {
      const text = await writeDocument(kind, guide, await renderForAi(), settings, setStreaming, ctrl.signal)
      if (text.trim()) onSave(text, 'ai')
      if (ctrl.signal.aborted) toast({ text: 'Stopped. Kept what was written so far.' })
    } catch (err) {
      toast({ text: (err as Error).message, tone: 'error' })
    } finally {
      setStreaming(null)
      abort.current = null
    }
  }

  const exportAs = (format: 'html' | 'pdf' | 'md' | 'copy') => {
    const full = wrapHtml(guide.title, markdownToHtml(markdown, shots))
    const name = `${slug(guide.title)}-${kind}`
    if (format === 'html') download(`${name}.html`, full, 'text/html')
    else if (format === 'pdf') printHtml(full)
    else if (format === 'md') download(`${name}.md`, markdownWithImages(markdown, shots), 'text/markdown')
    else
      navigator.clipboard.writeText(markdown).then(
        () => toast({ text: 'Markdown copied (screenshots are kept as placeholders).' }),
        () => toast({ text: 'Could not copy to the clipboard.', tone: 'error' }),
      )
  }

  const busy = streaming !== null

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-6">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h2 className="text-lg font-semibold">{LABELS[kind].name}</h2>
          {doc && !busy && (
            <p className="text-xs text-muted">
              {doc.source === 'ai' ? 'Written by Claude' : 'Built from template'} · edited {new Date(doc.updatedAt).toLocaleString()}
            </p>
          )}
          {busy && <p className="text-xs text-accent">Claude is writing…</p>}
        </div>
        {busy ? (
          <button className="btn-secondary" onClick={() => abort.current?.abort()}>
            Stop
          </button>
        ) : (
          <>
            <button className="btn-secondary" onClick={fromTemplate} disabled={!guide.steps.length}>
              <Icon name="doc" /> {doc ? 'Rebuild from template' : 'Use template'}
            </button>
            <button className="btn-primary" onClick={withAi} disabled={!guide.steps.length || !rendered}>
              <Icon name="sparkle" /> {doc?.source === 'ai' ? 'Rewrite with Claude' : 'Write with Claude'}
            </button>
            {doc && (
              <>
                <button className="btn-secondary" onClick={() => setEditing((e) => !e)}>
                  <Icon name={editing ? 'eye' : 'pen'} /> {editing ? 'Preview' : 'Edit'}
                </button>
                <Dropdown label="Export" icon="download">
                  {(close) => (
                    <>
                      {(
                        [
                          ['pdf', 'PDF (print / save as PDF)'],
                          ['html', 'HTML page'],
                          ['md', 'Markdown (.md)'],
                          ['copy', 'Copy Markdown'],
                        ] as const
                      ).map(([f, label]) => (
                        <button
                          key={f}
                          className="menu-item"
                          onClick={() => {
                            close()
                            exportAs(f)
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </>
                  )}
                </Dropdown>
              </>
            )}
          </>
        )}
      </div>

      {!doc && !busy ? (
        <div className="card p-10 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
            <Icon name={kind === 'sop' ? 'doc' : 'cap'} className="h-6 w-6" />
          </div>
          <h3 className="mb-1 text-base font-semibold">Create a {LABELS[kind].name.toLowerCase()}</h3>
          <p className="mx-auto mb-5 max-w-md text-sm text-muted">{LABELS[kind].blurb}</p>
          <p className="mx-auto max-w-md text-xs text-muted">
            <strong>Use template</strong> works offline from your steps. <strong>Write with Claude</strong> reads your steps and screenshots and writes the full document.
          </p>
        </div>
      ) : editing ? (
        <div>
          <p className="mb-2 text-xs text-muted">
            Markdown. Put <code className="rounded bg-raised px-1">{'{{screenshot:3}}'}</code> on its own line to show step 3's screenshot.
          </p>
          <textarea
            className="input min-h-[70vh] font-mono text-[13px] leading-relaxed"
            value={markdown}
            onChange={(e) => onSave(e.target.value, doc?.source ?? 'template')}
            aria-label="Document markdown"
          />
        </div>
      ) : (
        <DocFrame html={html} />
      )}
    </div>
  )
}
