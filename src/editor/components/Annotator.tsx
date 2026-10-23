import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { autoHighlight, COLORS, contrastText, HIGHLIGHT, normRect } from '../../shared/render'
import type { Annotation, AnnotationType, NRect, Step, StoredImage } from '../../shared/types'
import { uid } from '../../shared/types'
import { Icon } from '../ui'

export type Tool = 'select' | AnnotationType | 'crop'

const TOOLS: { id: Tool; label: string; icon: string; hint: string }[] = [
  { id: 'select', label: 'Select', icon: 'pointer', hint: 'Click to select, drag to move. Delete removes.' },
  { id: 'box', label: 'Box', icon: 'box', hint: 'Drag to draw a box.' },
  { id: 'arrow', label: 'Arrow', icon: 'arrow', hint: 'Drag from the tail to the tip.' },
  { id: 'text', label: 'Text', icon: 'text', hint: 'Click where the label should go, then type.' },
  { id: 'marker', label: 'Number', icon: 'marker', hint: 'Click to drop a numbered marker.' },
  { id: 'blur', label: 'Blur', icon: 'blur', hint: 'Drag over anything sensitive to redact it.' },
  { id: 'spotlight', label: 'Spotlight', icon: 'spotlight', hint: 'Drag to dim everything except this area.' },
  { id: 'crop', label: 'Zoom area', icon: 'crop', hint: 'Drag to choose the area to zoom in on. The dashed frame is the current zoom.' },
]

interface Result {
  annotations: Annotation[]
  crop?: NRect
  zoom?: 'full'
  showAutoHighlight: boolean
}

interface Draft {
  type: AnnotationType | 'crop'
  x1: number
  y1: number
  x2: number
  y2: number
}

let measureCtx: CanvasRenderingContext2D | null = null
function textWidth(text: string, size: number): number {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  measureCtx!.font = `600 ${size}px Inter, -apple-system, Segoe UI, Roboto, sans-serif`
  return measureCtx!.measureText(text).width
}

export function Annotator({ step, image, autoZoom, initialTool = 'box', onCancel, onSave }: { step: Step; image: StoredImage; autoZoom?: NRect; initialTool?: Tool; onCancel: () => void; onSave: (r: Result) => void }) {
  const [annotations, setAnnotations] = useState<Annotation[]>(step.annotations)
  const [crop, setCrop] = useState<NRect | undefined>(step.crop)
  const [showAuto, setShowAuto] = useState(step.showAutoHighlight !== false)
  const [tool, setTool] = useState<Tool>(initialTool)
  const [color, setColor] = useState(COLORS[0])
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const history = useRef<{ annotations: Annotation[]; crop?: NRect }[]>([])
  const svgRef = useRef<SVGSVGElement>(null)
  const textInput = useRef<HTMLInputElement>(null)
  const move = useRef<{ id: string; sx: number; sy: number; orig: Annotation } | null>(null)

  const currentColor = color
  const iw = image.w
  const ih = image.h
  const unit = iw / 450
  const P = (x: number) => x * iw
  const Q = (y: number) => y * ih

  const snapshot = useCallback(() => {
    history.current.push({ annotations, crop })
    if (history.current.length > 50) history.current.shift()
  }, [annotations, crop])

  const undo = useCallback(() => {
    const prev = history.current.pop()
    if (!prev) return
    setAnnotations(prev.annotations)
    setCrop(prev.crop)
    setSelected(null)
  }, [])

  const removeSelected = useCallback(() => {
    if (!selected) return
    snapshot()
    setAnnotations((a) => a.filter((x) => x.id !== selected))
    setSelected(null)
  }, [selected, snapshot])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (e.key === 'Escape') {
        if (selected) setSelected(null)
        else onCancel()
      } else if (!typing && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault()
        removeSelected()
      } else if (!typing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, removeSelected, selected, undo])

  const toNorm = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    }
  }

  const selectedAnn = annotations.find((a) => a.id === selected)

  const onStageDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const p = toNorm(e)
    if (tool === 'select') {
      setSelected(null)
      return
    }
    if (tool === 'text' || tool === 'marker') {
      snapshot()
      const n = annotations.filter((a) => a.type === 'marker').length + 1
      const ann: Annotation = { id: uid(), type: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y, color, text: tool === 'marker' ? String(n) : 'Click here' }
      setAnnotations((a) => [...a, ann])
      setSelected(ann.id)
      if (tool === 'text') setTimeout(() => textInput.current?.select(), 0)
      return
    }
    svgRef.current!.setPointerCapture(e.pointerId)
    setDraft({ type: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y })
  }

  const onStageMove = (e: RPointerEvent<SVGSVGElement>) => {
    const p = toNorm(e)
    if (draft) setDraft({ ...draft, x2: p.x, y2: p.y })
    else if (move.current) {
      const { id, sx, sy, orig } = move.current
      const dx = p.x - sx
      const dy = p.y - sy
      setAnnotations((a) => a.map((x) => (x.id === id ? { ...orig, x1: orig.x1 + dx, x2: orig.x2 + dx, y1: orig.y1 + dy, y2: orig.y2 + dy } : x)))
    }
  }

  const onStageUp = () => {
    move.current = null
    if (!draft) return
    const r = normRect(draft)
    const tiny = draft.type === 'arrow' ? Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) < 0.01 : r.w < 0.005 || r.h < 0.005
    if (!tiny) {
      snapshot()
      if (draft.type === 'crop') {
        setCrop(r)
      } else {
        const ann: Annotation = { id: uid(), type: draft.type, x1: draft.x1, y1: draft.y1, x2: draft.x2, y2: draft.y2, color }
        // Only one spotlight per screenshot.
        setAnnotations((a) => [...(draft.type === 'spotlight' ? a.filter((x) => x.type !== 'spotlight') : a), ann])
        setSelected(ann.id)
      }
    }
    setDraft(null)
  }

  const onAnnDown = (e: RPointerEvent, a: Annotation) => {
    if (tool !== 'select') return
    e.stopPropagation()
    setSelected(a.id)
    snapshot()
    const p = toNorm(e)
    move.current = { id: a.id, sx: p.x, sy: p.y, orig: a }
    svgRef.current!.setPointerCapture(e.pointerId)
  }

  const setColorFor = (c: string) => {
    setColor(c)
    if (selectedAnn && selectedAnn.type !== 'blur' && selectedAnn.type !== 'spotlight') {
      snapshot()
      setAnnotations((a) => a.map((x) => (x.id === selected ? { ...x, color: c } : x)))
    }
  }

  const hl = useMemo(() => autoHighlight({ ...step, showAutoHighlight: showAuto }), [step, showAuto])
  const activeHint = TOOLS.find((t) => t.id === tool)?.hint

  const renderAnn = (a: Annotation | Draft, key: string, isSel: boolean, interactive?: Annotation) => {
    const r = normRect(a)
    const common = interactive
      ? { onPointerDown: (e: RPointerEvent) => onAnnDown(e, interactive), style: { cursor: tool === 'select' ? 'move' : undefined } }
      : {}
    const color = 'color' in a ? a.color : currentColor
    let body: JSX.Element | null = null
    let bounds: NRect = r
    switch (a.type) {
      case 'box':
        body = <rect x={P(r.x)} y={Q(r.y)} width={P(r.w)} height={Q(r.h)} rx={unit * 2} fill="transparent" stroke={color} strokeWidth={unit * 1.5} />
        break
      case 'blur':
        body = <rect x={P(r.x)} y={Q(r.y)} width={P(r.w)} height={Q(r.h)} fill="url(#hatch)" stroke="#475569" strokeWidth={unit * 0.6} strokeDasharray={`${unit * 2} ${unit * 2}`} />
        break
      case 'spotlight':
        body = <rect x={P(r.x)} y={Q(r.y)} width={P(r.w)} height={Q(r.h)} rx={unit * 2} fill="transparent" stroke="#ffffff" strokeWidth={unit * 0.8} strokeDasharray={`${unit * 3} ${unit * 2}`} />
        break
      case 'crop':
        body = <rect x={P(r.x)} y={Q(r.y)} width={P(r.w)} height={Q(r.h)} fill="transparent" stroke="#ffffff" strokeWidth={unit} strokeDasharray={`${unit * 4} ${unit * 3}`} />
        break
      case 'arrow': {
        const x1 = P(a.x1), y1 = Q(a.y1), x2 = P(a.x2), y2 = Q(a.y2)
        const ang = Math.atan2(y2 - y1, x2 - x1)
        const head = unit * 7
        body = (
          <g>
            <line x1={x1} y1={y1} x2={x2 - Math.cos(ang) * head * 0.6} y2={y2 - Math.sin(ang) * head * 0.6} stroke={color} strokeWidth={unit * 1.5} strokeLinecap="round" />
            <polygon
              points={`${x2},${y2} ${x2 - head * Math.cos(ang - 0.45)},${y2 - head * Math.sin(ang - 0.45)} ${x2 - head * Math.cos(ang + 0.45)},${y2 - head * Math.sin(ang + 0.45)}`}
              fill={color}
            />
            {/* Wider invisible line so thin arrows are easy to grab. */}
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={unit * 8} />
          </g>
        )
        break
      }
      case 'text': {
        const size = unit * 7
        const text = ('text' in a && a.text) || 'Note'
        const pad = size * 0.45
        const w = textWidth(text, size) + pad * 2
        const h = size + pad * 1.6
        bounds = { x: a.x1, y: a.y1, w: w / iw, h: h / ih }
        body = (
          <g>
            <rect x={P(a.x1)} y={Q(a.y1)} width={w} height={h} rx={size * 0.35} fill={color} />
            <text x={P(a.x1) + pad} y={Q(a.y1) + h / 2 + 1} dominantBaseline="middle" fontSize={size} fontWeight={600} fill={contrastText(color)} fontFamily="Inter, -apple-system, Segoe UI, Roboto, sans-serif">
              {text}
            </text>
          </g>
        )
        break
      }
      case 'marker': {
        const rad = unit * 6.5
        bounds = { x: a.x1 - rad / iw, y: a.y1 - rad / ih, w: (rad * 2) / iw, h: (rad * 2) / ih }
        body = (
          <g>
            <circle cx={P(a.x1)} cy={Q(a.y1)} r={rad} fill={color} stroke="#fff" strokeWidth={unit * 0.8} />
            <text x={P(a.x1)} y={Q(a.y1) + 1} textAnchor="middle" dominantBaseline="middle" fontSize={rad * 1.15} fontWeight={700} fill={contrastText(color)} fontFamily="Inter, -apple-system, Segoe UI, Roboto, sans-serif">
              {('text' in a && a.text) || '1'}
            </text>
          </g>
        )
        break
      }
    }
    return (
      <g key={key} {...common}>
        {body}
        {isSel && (
          <rect x={P(bounds.x) - unit * 2} y={Q(bounds.y) - unit * 2} width={P(bounds.w) + unit * 4} height={Q(bounds.h) + unit * 4} fill="none" stroke="#4f46e5" strokeWidth={unit * 0.7} strokeDasharray={`${unit * 2} ${unit * 1.5}`} pointerEvents="none" />
        )}
      </g>
    )
  }

  const spot = annotations.find((a) => a.type === 'spotlight')
  const shownCrop = draft?.type === 'crop' ? normRect(draft) : (crop ?? (tool === 'crop' ? autoZoom : undefined))
  const dimOutside = (r: NRect, fill: string) => (
    <path
      d={`M0 0H${iw}V${ih}H0Z M${P(r.x)} ${Q(r.y)}h${P(r.w)}v${Q(r.h)}h${-P(r.w)}Z`}
      fillRule="evenodd"
      fill={fill}
      pointerEvents="none"
    />
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95" role="dialog" aria-label="Annotate screenshot">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-slate-900 px-4 py-2 text-white">
        <div className="flex items-center gap-0.5 rounded-lg bg-white/5 p-1">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={`${t.label}: ${t.hint}`}
              aria-pressed={tool === t.id}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${tool === t.id ? 'bg-white text-slate-900' : 'text-white/80 hover:bg-white/10'}`}
            >
              <Icon name={t.icon} />
              <span className="hidden lg:inline">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 px-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColorFor(c)}
              aria-label={`Color ${c}`}
              className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-white ring-2 ring-white/40' : 'border-white/20'}`}
              style={{ background: c }}
            />
          ))}
        </div>
        {selectedAnn && (selectedAnn.type === 'text' || selectedAnn.type === 'marker') && (
          <input
            ref={textInput}
            className="w-48 rounded-md border border-white/20 bg-white/10 px-2 py-1 text-sm text-white outline-none focus:border-white/60"
            value={selectedAnn.text ?? ''}
            aria-label="Label text"
            onChange={(e) => setAnnotations((a) => a.map((x) => (x.id === selected ? { ...x, text: e.target.value } : x)))}
          />
        )}
        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-white/80 hover:bg-white/10">
          <input type="checkbox" checked={showAuto} onChange={(e) => setShowAuto(e.target.checked)} className="accent-orange-500" />
          Click highlight
        </label>
        <div className="ml-auto flex items-center gap-1">
          <button className="rounded-md px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:opacity-40" onClick={undo} title="Undo (Ctrl+Z)">
            <Icon name="undo" />
          </button>
          <button className="rounded-md px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:opacity-40" disabled={!selected} onClick={removeSelected} title="Delete selected">
            <Icon name="trash" />
          </button>
          {crop && (
            <button
              className="rounded-md px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10"
              onClick={() => {
                snapshot()
                setCrop(undefined)
              }}
            >
              Back to auto zoom
            </button>
          )}
          <button className="rounded-md px-3 py-1.5 text-sm text-white/80 hover:bg-white/10" onClick={onCancel}>
            Cancel
          </button>
          <button className="rounded-md bg-white px-4 py-1.5 text-sm font-semibold text-slate-900 hover:bg-white/90" onClick={() => onSave({ annotations, crop, showAutoHighlight: showAuto, zoom: crop ? undefined : step.zoom })}>
            Save
          </button>
        </div>
      </div>
      <p className="px-4 py-1.5 text-center text-xs text-white/60">{activeHint}</p>

      {/* Stage */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
        <div className="relative inline-block select-none" style={{ aspectRatio: `${iw} / ${ih}`, maxWidth: '100%', maxHeight: '100%', width: `min(100%, calc((100vh - 140px) * ${iw / ih}))` }}>
          <img src={image.dataUrl} alt="" className="block h-full w-full rounded" draggable={false} />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${iw} ${ih}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            style={{ cursor: tool === 'select' ? 'default' : 'crosshair', touchAction: 'none' }}
            onPointerDown={onStageDown}
            onPointerMove={onStageMove}
            onPointerUp={onStageUp}
          >
            <defs>
              <pattern id="hatch" width={unit * 4} height={unit * 4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width={unit * 4} height={unit * 4} fill="#cbd5e1" />
                <rect width={unit * 2} height={unit * 4} fill="#94a3b8" />
              </pattern>
            </defs>
            {spot && dimOutside(normRect(spot), 'rgba(15,23,42,0.55)')}
            {hl?.kind === 'rect' && (
              <rect x={P(hl.rect.x)} y={Q(hl.rect.y)} width={P(hl.rect.w)} height={Q(hl.rect.h)} rx={unit * 2} fill="rgba(249,115,22,0.12)" stroke={HIGHLIGHT} strokeWidth={unit * 1.4} pointerEvents="none" />
            )}
            {hl?.kind === 'circle' && <circle cx={P(hl.x)} cy={Q(hl.y)} r={unit * 9} fill="rgba(249,115,22,0.18)" stroke={HIGHLIGHT} strokeWidth={unit * 1.4} pointerEvents="none" />}
            {annotations.map((a) => renderAnn(a, a.id, a.id === selected, a))}
            {draft && draft.type !== 'crop' && renderAnn({ ...draft, color } as Annotation, 'draft', false)}
            {shownCrop && (
              <g pointerEvents="none">
                {dimOutside(shownCrop, 'rgba(0,0,0,0.6)')}
                {renderAnn({ type: 'crop', x1: shownCrop.x, y1: shownCrop.y, x2: shownCrop.x + shownCrop.w, y2: shownCrop.y + shownCrop.h }, 'crop', false)}
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  )
}
