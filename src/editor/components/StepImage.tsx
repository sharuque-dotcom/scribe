import { useEffect, useState } from 'react'
import { renderStep, type RenderView } from '../../shared/render'
import type { Step, StoredImage } from '../../shared/types'

// Shows a step's screenshot with its highlight, annotations and redactions applied.
export function StepImage({ step, image, view, maxWidth = 1400, className = '', onClick }: { step: Step; image?: StoredImage; view?: RenderView; maxWidth?: number; className?: string; onClick?: () => void }) {
  const [src, setSrc] = useState<string>()
  const key = JSON.stringify([step.annotations, step.crop, step.targetRect, step.click, step.showAutoHighlight, image?.id, view])

  useEffect(() => {
    if (!image) return
    let live = true
    renderStep(step, image, { maxWidth, view }).then((s) => live && setSrc(s))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, maxWidth])

  if (!image) return null
  const img = src ? (
    <img src={src} alt={`Screenshot: ${step.title}`} className="block w-full rounded-lg border border-line" draggable={false} />
  ) : (
    <div className="aspect-[16/10] w-full animate-pulse rounded-lg bg-raised" />
  )
  if (!onClick) return <div className={className}>{img}</div>
  return (
    <button type="button" onClick={onClick} className={`group relative block w-full text-left ${className}`} title="Annotate this screenshot">
      {img}
      <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-ink/80 px-2.5 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
        Annotate
      </span>
    </button>
  )
}
