// Practice results: turning a practice run into a result ("Completed in 2:10,
// 1 hint, 1 mistake") and a certificate a learner can hand to their manager.
import type { GuideMeState, PracticeAttempt } from './types'
import { uid } from './types'

// The steps a learner actually does (not notes, headings or page visits).
export const doSteps = (st: Pick<GuideMeState, 'steps'>) =>
  st.steps.map((s, i) => ({ s, i })).filter(({ s }) => s.kind === 'step' && s.action !== 'navigate')

export function attemptOf(st: GuideMeState, now = Date.now()): PracticeAttempt {
  // Steps that were already done when practice got to them aren't scored.
  const already = new Set(st.already ?? [])
  const steps = doSteps(st).filter(({ i }) => !already.has(i))
  const hinted = new Set(st.hints ?? [])
  let skipped = 0
  let onOwn = 0
  let hints = 0
  for (const { i } of steps) {
    const r = st.results?.[i]
    if (r === 'skipped' && !hinted.has(i)) skipped++
    else if (hinted.has(i)) hints++
    else if (r === 'missed') skipped++
    else onOwn++
  }
  return {
    id: uid(),
    at: now,
    learner: st.learner?.trim() || 'Someone',
    durationMs: Math.max(0, now - (st.startedAt ?? now)),
    steps: steps.length,
    onOwn,
    hints,
    mistakes: st.mistakes ?? 0,
    skipped,
    completed: st.index >= st.steps.length,
  }
}

export function duration(ms: number): string {
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  return m ? `${m}:${String(s % 60).padStart(2, '0')}` : `${s}s`
}

// "Completed in 2:10 · 6 of 6 steps on your own · 1 hint · 1 mistake"
export function resultLine(a: PracticeAttempt): string {
  const parts = [`${a.completed ? 'Completed' : 'Stopped'} in ${duration(a.durationMs)}`, `${a.onOwn} of ${a.steps} steps on their own`]
  if (a.hints) parts.push(`${a.hints} hint${a.hints === 1 ? '' : 's'}`)
  if (a.mistakes) parts.push(`${a.mistakes} mistake${a.mistakes === 1 ? '' : 's'}`)
  if (a.skipped) parts.push(`${a.skipped} skipped`)
  return parts.join(' · ')
}

// A plain verdict for the top of the result.
export function verdict(a: PracticeAttempt): string {
  if (!a.completed) return 'Not finished'
  if (a.onOwn === a.steps && !a.mistakes) return 'Done on their own, without mistakes'
  if (a.onOwn === a.steps) return 'Done on their own'
  if (!a.skipped) return 'Done with some help'
  return 'Done, with steps skipped'
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

// A one-page certificate (HTML, prints to PDF). Made on this computer.
export function certificateHtml(a: PracticeAttempt, guideTitle: string): string {
  const date = new Date(a.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const row = (k: string, v: string) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Practice result: ${esc(guideTitle)}</title>
<style>
body{margin:0;background:#faf8f4;color:#151412;font:16px/1.5 Inter,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:720px;margin:40px auto;background:#fff;border:1px solid #e7e2d9;border-radius:24px;padding:48px 52px}
.brand{display:flex;align-items:center;gap:10px;font-weight:600;color:#6e6860;font-size:14px}
.dots{display:inline-flex;gap:3px}.dots i{width:9px;height:9px;border-radius:50%;display:block}
h1{font-size:30px;line-height:1.2;margin:28px 0 6px;letter-spacing:-.01em}
.who{font-size:20px;margin:0 0 4px}.task{color:#6e6860;margin:0 0 28px}
.verdict{display:inline-block;padding:6px 14px;border-radius:999px;background:${a.completed && a.onOwn === a.steps ? '#dcfce7;color:#166534' : '#fef3c7;color:#92400e'};font-weight:600;margin-bottom:24px}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:10px 0;border-top:1px solid #efeae2}th{width:45%;color:#6e6860;font-weight:500}
.foot{margin-top:28px;font-size:12px;color:#8a837a}
@media print{body{background:#fff}main{border:0;margin:0}}
</style></head><body><main>
<div class="brand"><span class="dots"><i style="background:#F97316"></i><i style="background:#e7e2d9"></i><i style="background:#818CF8"></i></span>StepCrumb · Practice result</div>
<h1>${esc(guideTitle)}</h1>
<p class="who"><b>${esc(a.learner)}</b></p>
<p class="task">Practised on ${esc(date)}, on the live system, with Save, Submit and similar buttons stopped so nothing was changed.</p>
<div class="verdict">${esc(verdict(a))}</div>
<table>
${row('Time taken', duration(a.durationMs))}
${row('Steps done on their own', `${a.onOwn} of ${a.steps}`)}
${row('Hints used ("Show me")', String(a.hints))}
${row('Wrong clicks', String(a.mistakes))}
${a.skipped ? row('Steps skipped', String(a.skipped)) : ''}
</table>
<p class="foot">Recorded by StepCrumb on the learner's computer. Reference ${esc(a.id)}.</p>
</main></body></html>`
}
