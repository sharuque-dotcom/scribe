// Practice results on this computer: who practised the guide, how it went, and
// a certificate to download for each run.
import { useState } from 'react'
import { certificateHtml, duration, resultLine, verdict } from '../../shared/practice'
import { download, slug } from '../../shared/export'
import type { Guide } from '../../shared/types'
import { Icon, timeAgo } from '../ui'

export function PracticeResults({ guide, onClear }: { guide: Guide; onClear: () => void }) {
  const [all, setAll] = useState(false)
  const attempts = guide.attempts ?? []
  if (!attempts.length) return null
  const shown = all ? attempts : attempts.slice(0, 3)
  return (
    <section className="mt-4 rounded-2xl border border-line bg-surface p-4" aria-label="Practice results">
      <div className="mb-2 flex items-center gap-2">
        <Icon name="cap" className="h-4 w-4 text-accent" />
        <h3 className="mr-auto text-sm font-semibold">Practice results</h3>
        <span className="text-xs text-muted">Kept on this computer</span>
      </div>
      <ul className="divide-y divide-line">
        {shown.map((a) => {
          const clean = a.completed && a.onOwn === a.steps && !a.mistakes
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
              <span className={`h-2 w-2 flex-none rounded-full ${clean ? 'bg-green-500' : a.completed ? 'bg-amber-400' : 'bg-line'}`} aria-hidden />
              <span className="font-medium">{a.learner}</span>
              <span className="text-muted">{verdict(a)}</span>
              <span className="text-xs text-muted" title={new Date(a.at).toLocaleString()}>
                {timeAgo(a.at)} · {duration(a.durationMs)}
              </span>
              <span className="w-full pl-5 text-xs text-muted sm:order-last">{resultLine(a)}</span>
              <button
                className="ml-auto text-xs font-medium text-accent hover:underline"
                onClick={() => download(`practice-${slug(a.learner)}-${slug(guide.title)}.html`, certificateHtml(a, guide.title), 'text/html')}
              >
                Certificate
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-1 flex gap-4 text-xs">
        {attempts.length > 3 && (
          <button className="font-medium text-muted hover:text-ink" onClick={() => setAll((x) => !x)}>
            {all ? 'Show fewer' : `Show all ${attempts.length}`}
          </button>
        )}
        <button className="ml-auto text-muted hover:text-rec" onClick={() => confirm('Clear all practice results for this guide?') && onClear()}>
          Clear results
        </button>
      </div>
    </section>
  )
}
