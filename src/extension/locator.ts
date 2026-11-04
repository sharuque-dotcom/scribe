// Guide me, page side: records the clues for an element (when capturing) and
// finds the element again on the live page (when playing). Searches inside
// open shadow roots too, which apps like Salesforce use for most controls.
import { cleanLabel } from '../shared/describe'
import { rank, stableId } from '../shared/locate'
import type { Locator } from '../shared/types'

const CANDIDATES =
  'a[href],button,input:not([type=hidden]),select,textarea,summary,label,[role=button],[role=link],[role=tab],[role=menuitem],[role=menuitemradio],[role=menuitemcheckbox],[role=checkbox],[role=switch],[role=radio],[role=option],[role=combobox],[role=textbox],[contenteditable=""],[contenteditable=true],[onclick],[tabindex]'

const TEST_ATTRS = ['data-testid', 'data-test-id', 'data-test', 'data-qa', 'data-cy', 'data-automation-id']

const short = (s: string | null | undefined, max = 80) => {
  const t = cleanLabel((s ?? '').split('\n').find((l) => l.trim()) ?? '')
  return t ? t.slice(0, max) : undefined
}

// The section an element sits in: the nearest dialog, form, region or fieldset
// with a name, else the nearest heading above it in its container.
function contextOf(el: Element): string | undefined {
  let cur: Element | null = el.parentElement
  for (let i = 0; cur && i < 12; i++) {
    const named = cur.getAttribute('aria-label') || (cur.getAttribute('aria-labelledby') && document.getElementById(cur.getAttribute('aria-labelledby')!.split(/\s+/)[0])?.textContent)
    if (named && /^(dialog|form|region|group|tabpanel|navigation|complementary)$/.test(cur.getAttribute('role') ?? '') || (named && /^(FORM|SECTION|FIELDSET|NAV|ASIDE|DIALOG)$/.test(cur.tagName))) return short(named)
    if (cur.tagName === 'FIELDSET') {
      const legend = cur.querySelector('legend')?.textContent
      if (legend) return short(legend)
    }
    const heading = cur.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > header h1, :scope > header h2, :scope > header h3')
    if (heading && heading !== el && !heading.contains(el)) return short(heading.textContent)
    cur = cur.parentElement ?? ((cur.getRootNode() as ShadowRoot).host ?? null)
  }
  return undefined
}

function pagePos(el: Element): { pageX?: number; pageY?: number } {
  const r = el.getBoundingClientRect()
  if (r.width <= 0 && r.height <= 0) return {}
  const W = Math.max(document.documentElement.scrollWidth, innerWidth)
  const H = Math.max(document.documentElement.scrollHeight, innerHeight)
  return { pageX: (r.left + scrollX + r.width / 2) / W, pageY: (r.top + scrollY + r.height / 2) / H }
}

// `label` is the name StepCrumb already worked out for the step (describeTarget).
export function locatorOf(el: Element, label?: string): Locator {
  const he = el as HTMLElement
  const testAttr = TEST_ATTRS.find((a) => el.hasAttribute(a))
  const href = el instanceof HTMLAnchorElement && el.href ? (() => {
    try {
      const u = new URL(el.href)
      return u.pathname + u.search
    } catch {
      return undefined
    }
  })() : undefined
  return {
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role') ?? undefined,
    type: el instanceof HTMLInputElement ? el.type : undefined,
    id: stableId(el.id),
    name: stableId(el.getAttribute('name')),
    testId: testAttr ? el.getAttribute(testAttr) ?? undefined : undefined,
    aria: short(el.getAttribute('aria-label')),
    label: short(label),
    text: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement ? undefined : short(he.innerText, 60),
    placeholder: short(el.getAttribute('placeholder')),
    href,
    context: contextOf(el),
    ...pagePos(el),
  }
}

// Every candidate element on the page, including inside open shadow roots.
function allCandidates(): Element[] {
  const out: Element[] = []
  const visit = (root: Document | ShadowRoot) => {
    root.querySelectorAll(CANDIDATES).forEach((el) => out.push(el))
    root.querySelectorAll('*').forEach((el) => el.shadowRoot && visit(el.shadowRoot))
  }
  visit(document)
  return out
}

const visible = (el: Element) => {
  const r = el.getBoundingClientRect()
  if (r.width < 2 || r.height < 2) return false
  const s = getComputedStyle(el)
  return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
}

export interface Match {
  el: Element
  // Its clues as they are now (for self-repair).
  locator: Locator
  score: number
  runnerUp: number
}

// The element on the live page that best matches the recorded clues, or null.
// `labelFor` gives the same label StepCrumb would have used when capturing.
export function findMatch(saved: Locator, labelFor: (el: Element) => string): Match | null {
  // Only elements of the same kind are worth the full comparison.
  const els = allCandidates().filter((el) => (el.tagName.toLowerCase() === saved.tag || (!!saved.role && el.getAttribute('role') === saved.role)) && visible(el))
  const cands = els.map((el) => locatorOf(el, labelFor(el)))
  const r = rank(saved, cands)
  return r.index >= 0 ? { el: els[r.index], locator: cands[r.index], score: r.score, runnerUp: r.runnerUp } : null
}

export const findElement = (saved: Locator, labelFor: (el: Element) => string): Element | null => findMatch(saved, labelFor)?.el ?? null

// Signs that the page is still loading: the document itself, a busy region,
// a progress bar or spinner on screen.
export function pageBusy(): boolean {
  if (document.readyState !== 'complete') return true
  if (document.querySelector('[aria-busy="true"]')) return true
  const spinners = document.querySelectorAll('[role="progressbar"], .spinner, .loading, .loader, .skeleton, [class*="spinner"], [class*="Spinner"], [class*="loading"], [class*="skeleton"]')
  for (const el of spinners) if (visible(el)) return true
  return false
}
