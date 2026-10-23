import { useState } from 'react'
import type { NoteStyle, Step, StoredImage } from '../../shared/types'
import { AutoText, Icon } from '../ui'
import { StepImage } from './StepImage'

interface Props {
  step: Step
  number?: number
  image?: StoredImage
  first: boolean
  last: boolean
  readOnly: boolean
  onChange: (patch: Partial<Step>) => void
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
  onAnnotate: () => void
}

const NOTE_STYLES: Record<NoteStyle, { label: string; cls: string }> = {
  info: { label: 'Note', cls: 'border-blue-400 bg-blue-50' },
  tip: { label: 'Tip', cls: 'border-green-500 bg-green-50' },
  warning: { label: 'Warning', cls: 'border-amber-500 bg-amber-50' },
}

export function StepCard({ step, number, image, first, last, readOnly, onChange, onMove, onDelete, onAnnotate }: Props) {
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
      {image && <StepImage step={step} image={image} className="mt-4" maxWidth={1200} onClick={readOnly ? undefined : onAnnotate} />}
      {step.url && (
        <p className="mt-2 truncate text-xs text-muted" title={step.url}>
          {step.pageTitle ? `${step.pageTitle} · ` : ''}
          {step.url}
        </p>
      )}
    </div>
  )
}
