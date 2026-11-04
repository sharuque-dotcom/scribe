// Guide me rules that don't need a browser: what a step expects, which buttons
// are "final" (practice mode stops them), how pages are matched, and the health
// score shown in the editor.
import type { Guide, GuideHealth, Step, StepHealth } from './types'

// What the step typed or chose, from its text: `Type "Acme" into the "Company"
// field` → "Acme". Secret and personal values are never quoted in step text
// ("Enter your password", "Type an email address…"), so they have no expectation.
export function expectedOf(step: Pick<Step, 'action' | 'title'>): string | undefined {
  if (step.action === 'type') return /^Type "(.+)"(?: into |$)/.exec(step.title)?.[1]
  if (step.action === 'select') return /^Select "(.+)"(?: from |$)/.exec(step.title)?.[1]
  return undefined
}

// For checkbox steps: whether the guide ticked it ("Check …") or cleared it ("Uncheck …").
export function checkedOf(step: Pick<Step, 'action' | 'title' | 'target'>): boolean | undefined {
  const box = step.target?.inputType === 'checkbox' || step.target?.role === 'checkbox' || step.target?.role === 'switch'
  if (!box) return undefined
  if (/^Uncheck /.test(step.title)) return false
  if (/^Check /.test(step.title)) return true
  return undefined
}

// Buttons that commit something in the app. In practice mode they're stopped
// before they reach it. Matched on the button's own name, whole words only.
const FINAL = /\b(save|submit|send|delete|remove|pay|purchase|buy|checkout|check out|place order|confirm|approve|publish|post|transfer|sign|apply|book|order|create|finish|complete|update|deactivate|archive|cancel (?:order|subscription|booking))\b/i
export const isFinalAction = (label: string | undefined) => !!label && FINAL.test(label)

// A page, for matching guides to the page you're on: origin and path, without
// a trailing slash, query or hash.
export function pageKey(url: string | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (!/^https?:$/.test(u.protocol)) return null
    return u.origin + (u.pathname.replace(/\/+$/, '') || '/')
  } catch {
    return null
  }
}

// The pages a guide visits.
export const guidePages = (g: Guide) => new Set(g.steps.map((s) => pageKey(s.url)).filter((k): k is string => !!k))

// Steps Guide me can point at (the rest are notes, headings and page visits).
export const elementSteps = (g: Guide) => g.steps.filter((s) => s.kind === 'step' && s.action !== 'navigate' && s.action !== 'key')

export interface HealthSummary {
  total: number
  ok: number
  repaired: number
  missed: number
  unchecked: number
  at: number
  source: GuideHealth['source']
}

// "9 of 10 steps OK": found or repaired count as OK; skipped steps (already
// done, or skipped by the learner) and steps that couldn't be checked aren't
// held against the guide.
export function healthSummary(g: Guide): HealthSummary | null {
  const h = g.health
  if (!h) return null
  const steps = elementSteps(g)
  const tally: Record<StepHealth, number> = { found: 0, repaired: 0, missed: 0, skipped: 0, unchecked: 0 }
  for (const s of steps) tally[h.results[s.id] ?? 'unchecked']++
  const judged = tally.found + tally.repaired + tally.missed
  return { total: judged, ok: tally.found + tally.repaired, repaired: tally.repaired, missed: tally.missed, unchecked: tally.unchecked + tally.skipped, at: h.at, source: h.source }
}
