import { useState } from 'react'
import type { NoteStyle, Step, StoredImage } from '../../shared/types'
import { focusRect, MAX_FACTOR, REASON_TEXT, zoomAround, type StepView } from '../../shared/zoom'
import { AutoText, Icon } from '../ui'
import { StepImage } from './StepImage'

interface Props {
  step: Step
  number?: number
  image?: StoredImage
  view?: StepView
  first: boolean
  last: boolean
  readOnly: boolean
  onChange: (patch: Partial<Step>) => void
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
  onAnnotate: () => void
  onAdjustZoom: () => void
}

const NOTE_STYLES: Record<NoteStyle, { label: string; cls: string }> = {
  info: { label: 'Note', cls: 'border-blue-400 bg-blue-50' },
  tip: { label: 'Tip', cls: 'border-green-500 bg-green-50' },
  warning: { label: 'Warning', cls: 'border-amber-500 bg-amber-50' },
}

export function StepCard({ step, number, image, view, first, last, readOnly, onChange, onMove, onDelete, onAnnotate, onAdjustZoom }: Props) {
  const [showDetail, setShowDetail] = useState(!!step.detail)

  const tools = !readOnly && (
    <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/card:opacity-100">
      {step.kind === 'step' && image && (
        <button className="icon-btn" onClick={onAnnotate} title="Annotate screenshot" aria-label="Annotate screenshot">
          <Icon name="pen" />
        </button>
      )}
      <button className="icon-btn" disabled={first} onClick={() => onMove(-1)} title="Move up" aria-label="Move up">
        <Icon name="up" />
      </button>
      <button className="icon-btn" disabled={last} onClick={() => onMove(1)} title="Move down" aria-label="Move down">
        <Icon name="down" />
      </button>
      <button className="icon-btn hover:!text-rec" onClick={onDelete} title="Delete" aria-label="Delete">
        <Icon name="trash" />
      </button>
    </div>
  )

  if (step.kind === 'heading') {
    return (
      <div className="group/card flex items-center gap-3 pt-4" id={`step-${step.id}`}>
        <AutoText value={step.title} onChange={(title) => onChange({ title })} placeholder="Section heading" ariaLabel="Section heading" className="text-xl font-semibold" />
        {tools}
      </div>
    )
  }

  if (step.kind === 'note') {
    const style = NOTE_STYLES[step.noteStyle ?? 'info']
    return (
      <div className={`group/card rounded-xl border-l-4 p-4 ${style.cls}`} id={`step-${step.id}`}>
        <div className="mb-1 flex items-center justify-between">
          <select
            className="rounded bg-transparent text-xs font-semibold uppercase tracking-wide text-ink/70 outline-none"
            value={step.noteStyle ?? 'info'}
            disabled={readOnly}
            onChange={(e) => onChange({ noteStyle: e.target.value as NoteStyle })}
            aria-label="Note style"
          >
            {Object.entries(NOTE_STYLES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          {tools}
        </div>
        <AutoText value={step.title} onChange={(title) => onChange({ title })} placeholder="Write a note, tip or warning" ariaLabel="Note text" className="font-medium" />
      </div>
    )
  }

  return (
    <div className="group/card card p-5" id={`step-${step.id}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-full bg-orange-500 text-sm font-bold text-white">{number}</span>
        <div className="min-w-0 flex-1">
          <AutoText value={step.title} onChange={(title) => onChange({ title })} placeholder="Describe this step" ariaLabel={`Step ${number} text`} className="text-[16px] font-semibold leading-snug" />
          {showDetail ? (
            <AutoText value={step.detail ?? ''} onChange={(detail) => onChange({ detail })} placeholder="Add more detail (optional)" ariaLabel={`Step ${number} detail`} className="mt-1 text-sm text-muted" autoFocus={!step.detail} />
          ) : (
            !readOnly && (
              <button className="mt-1 text-xs font-medium text-muted hover:text-accent" onClick={() => setShowDetail(true)}>
                + Add detail
              </button>
            )
          )}
        </div>
        {tools}
      </div>
      {image && <StepImage step={step} image={image} view={view} className="mt-4" maxWidth={1200} onClick={readOnly ? undefined : onAnnotate} />}
      {image && view && !readOnly && <ZoomControls step={step} image={image} view={view} onChange={onChange} onAdjust={onAdjustZoom} />}
      {step.url && (
        <p className="mt-2 truncate text-xs text-muted" title={step.url}>
          {step.pageTitle ? `${step.pageTitle} · ` : ''}
          {step.url}
        </p>
      )}
    </div>
  )
}

type ZoomChoice = 'auto' | 'full' | 'custom'

// Full screen / auto zoom / custom zoom for one screenshot.
function ZoomControls({ step, image, view, onChange, onAdjust }: { step: Step; image: StoredImage; view: StepView; onChange: (p: Partial<Step>) => void; onAdjust: () => void }) {
  const choice: ZoomChoice = step.crop ? 'custom' : step.zoom === 'full' ? 'full' : 'auto'

  const pick = (c: ZoomChoice) => {
    if (c === 'auto') onChange({ crop: undefined, zoom: undefined })
    else if (c === 'full') onChange({ crop: undefined, zoom: 'full' })
    else {
      // Start from what's shown now, or a 2x zoom on the clicked element.
      const focus = focusRect(step) ?? { x: 0.4, y: 0.4, w: 0.2, h: 0.2 }
      onChange({ crop: view.crop ?? zoomAround(focus, image, 2), zoom: undefined })
    }
  }

  const setFactor = (f: number) => {
    const c = step.crop
    if (!c) return
    // Keep the same centre while changing how far in it goes.
    const centre = { x: c.x + c.w / 2, y: c.y + c.h / 2, w: 0, h: 0 }
    onChange({ crop: zoomAround(centre, image, f) })
  }

  const factor = view.factor
  const label = choice === 'auto' ? (view.reason === 'zoomed' ? `Auto zoom · ${factor.toFixed(1)}×` : REASON_TEXT[view.reason]) : choice === 'full' ? 'Full screen' : `Custom zoom · ${factor.toFixed(1)}×`

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
      <div className="inline-flex rounded-md border border-line bg-raised p-0.5" role="group" aria-label="Screenshot zoom">
        {(
          [
            ['auto', 'Auto'],
            ['full', 'Full screen'],
            ['custom', 'Zoom'],
          ] as const
        ).map(([c, l]) => (
          <button key={c} onClick={() => pick(c)} aria-pressed={choice === c} className={`rounded px-2.5 py-1 font-medium ${choice === c ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
            {l}
          </button>
        ))}
      </div>
      {choice === 'custom' && (
        <>
          <input
            type="range"
            min={1.25}
            max={MAX_FACTOR}
            step={0.05}
            value={Math.min(factor, MAX_FACTOR)}
            onChange={(e) => setFactor(Number(e.target.value))}
            aria-label="Zoom level"
            className="w-28 accent-indigo-600"
          />
          <button className="font-medium text-accent hover:underline" onClick={onAdjust}>
            Move zoom area
          </button>
        </>
      )}
      <span className="text-muted">{label}</span>
    </div>
  )
}
