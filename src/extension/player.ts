// Guide me, on the page: dims the page, spotlights the element for the current
// step, shows the step in a small card, and moves on when the learner does the
// step. Progress lives in the background, so it carries on across pages.
//
// On top of that, without any AI, just rules and what the page shows:
// - Self-repair: when the learner does a step on an element whose clues have
//   changed (renamed, new id), the guide's clues are updated.
// - Results: each step is reported as found, repaired, missed or skipped, for
//   the guide's health score.
// - Smart waiting: while the page is loading, it waits instead of giving up.
// - Already done: steps whose result is already on the page are skipped.
// - Checking: a different dropdown choice is pointed out; empty required
//   fields are flagged before Save.
// - Off track: leaving the step's page offers to go back.
// - Practice: the learner does each step on their own; the spotlight only shows
//   when they ask ("Show me", counted as a hint), wrong clicks are counted, and
//   final actions (Save, Submit, Pay…) are stopped before they reach the app.
//   The result can be downloaded as a certificate.
import type { GuideMeState, GuideMeStep, StepHealth } from '../shared/types'
import { confidentMatch, repairedLocator } from '../shared/locate'
import { isFinalAction } from '../shared/guideme'
import { certificateHtml, resultLine } from '../shared/practice'
import type { PracticeAttempt } from '../shared/types'
import { findMatch, pageBusy, type Match } from './locator'

type Send = (msg: object) => Promise<unknown>

// Look this long (once the page is quiet) before showing the screenshot instead.
const FIND_FOR_MS = 4000
const QUIET_MS = 1500
// Never wait longer than this for a slow page.
const WAIT_MAX_MS = 15000
// A click step that can't be found, while a later step's element is on screen:
// after this long, the learner is assumed to be past it.
const AHEAD_AFTER_MS = 1500

export function createPlayer(send: Send, labelFor: (el: Element) => string) {
  const host = document.createElement('div')
  host.setAttribute('data-stepcrumb-guide', '')
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483646;pointer-events:none;'
  // Open, so tests (and screen readers' tooling) can reach the card.
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `
    <style>
      *{box-sizing:border-box}
      .dim{position:fixed;inset:0;background:rgba(15,23,42,.45);transition:opacity .2s}
      .hole{position:fixed;border-radius:10px;box-shadow:0 0 0 9999px rgba(15,23,42,.45);transition:all .25s ease;pointer-events:none}
      .ring{position:fixed;border-radius:10px;border:3px solid #6366f1;box-shadow:0 0 0 4px rgba(99,102,241,.25);transition:all .25s ease;pointer-events:none;animation:pulse 1.6s ease-in-out infinite}
      .ring.warn{border-color:#f59e0b;box-shadow:0 0 0 4px rgba(245,158,11,.25)}
      @keyframes pulse{50%{box-shadow:0 0 0 9px rgba(99,102,241,.12)}}
      .card{position:fixed;width:340px;max-width:calc(100vw - 24px);background:#fff;color:#0f172a;border-radius:14px;padding:14px 16px 12px;
        font:400 14px/1.45 Inter,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 18px 50px -12px rgba(15,23,42,.45);pointer-events:auto;transition:top .25s ease,left .25s ease}
      .top{display:flex;align-items:center;gap:8px;margin-bottom:6px;color:#64748b;font-size:12px;font-weight:600}
      .logo{width:16px;height:16px;border-radius:4px;background:#4f46e5;flex:none}
      .practice{padding:1px 7px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px}
      .x{all:unset;cursor:pointer;margin-left:auto;color:#94a3b8;font-size:18px;line-height:1;padding:2px 4px;border-radius:6px}
      .x:hover{color:#0f172a;background:#f1f5f9}
      .title{font-size:15px;font-weight:600;line-height:1.35}
      .detail{margin-top:4px;color:#475569}
      .note{margin-top:8px;padding:8px 10px;border-radius:8px;background:#f8fafc;color:#475569;font-size:13px}
      .note.warn{background:#fffbeb;color:#92400e}
      .note.good{background:#f0fdf4;color:#166534}
      .flash{margin-top:8px;font-size:12px;color:#166534}
      .shot{display:block;width:100%;max-height:200px;object-fit:cover;object-position:center;margin-top:8px;border-radius:8px;border:1px solid #e2e8f0}
      .row{display:flex;gap:6px;margin-top:12px;align-items:center}
      .bar{flex:1;height:4px;border-radius:2px;background:#e2e8f0;overflow:hidden}
      .bar i{display:block;height:100%;background:#6366f1;border-radius:2px;transition:width .3s}
      button.b{all:unset;cursor:pointer;padding:6px 11px;border-radius:8px;font-weight:600;font-size:13px;background:#f1f5f9;color:#0f172a}
      button.b:hover{background:#e2e8f0}
      button.p{background:#4f46e5;color:#fff}
      button.p:hover{background:#4338ca}
      button.b:focus-visible,.x:focus-visible{outline:2px solid #a5b4fc;outline-offset:1px}
      .name{all:unset;display:block;box-sizing:border-box;width:100%;margin-top:10px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;color:#0f172a;background:#fff}
      .name:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.2)}
      .stats{margin-top:10px;font-size:13px;color:#334155}
      .hidden{display:none}
    </style>
    <div class="dim hidden"></div>
    <div class="hole hidden"></div>
    <div class="ring hidden"></div>
    <div class="card" role="dialog" aria-live="polite" aria-label="StepCrumb Guide me">
      <div class="top"><span class="logo"></span><span class="count"></span><span class="practice hidden" title="Save, Submit, Pay and similar buttons are stopped, so nothing is changed">Practice</span><button class="x" type="button" title="Exit Guide me" aria-label="Exit Guide me">×</button></div>
      <div class="title"></div>
      <div class="detail hidden"></div>
      <div class="flash hidden"></div>
      <div class="note hidden"></div>
      <img class="shot hidden" alt="What to look for">
      <div class="row"><div class="bar"><i></i></div><span class="buttons"></span></div>
    </div>`
  const $ = <T extends Element>(s: string) => root.querySelector(s) as T
  const dim = $<HTMLElement>('.dim')
  const hole = $<HTMLElement>('.hole')
  const ring = $<HTMLElement>('.ring')
  const card = $<HTMLElement>('.card')
  const count = $<HTMLElement>('.count')
  const practiceTag = $<HTMLElement>('.practice')
  const title = $<HTMLElement>('.title')
  const detail = $<HTMLElement>('.detail')
  const flash = $<HTMLElement>('.flash')
  const note = $<HTMLElement>('.note')
  const shot = $<HTMLImageElement>('.shot')
  const progress = $<HTMLElement>('.bar i')
  const buttons = $<HTMLElement>('.buttons')

  let st: GuideMeState | null = null
  // The element being pointed at, and how it was matched.
  let target: Element | null = null
  let match: Match | null = null
  // A field to point at instead for a moment (an empty required field).
  let detour: Element | null = null
  let lookingSince = 0
  let lastBusy = 0
  let raf = 0
  let poll = 0
  let off: (() => void) | null = null
  let gone = false
  // A short line shown on the next step's card ("Step 3 was already done").
  let carry: string | null = null
  // The last step's final action was stopped (practice), so the page didn't move on.
  let held = false
  // Practice: the spotlight for this step has been asked for ("Show me").
  let revealed = false
  const quietPractice = () => !!st?.practice && !revealed && !detour

  // The page changing (not our overlay) means it may still be loading.
  new MutationObserver((records) => {
    if (records.some((r) => r.target !== host && !host.contains(r.target as Node))) lastBusy = Date.now()
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-busy'] })

  // Practice: a click on another button or field than the step's is a mistake.
  // Final actions (Save, Submit, Pay…) are stopped wherever they are.
  const INTERACTIVE = 'a[href],button,input,select,textarea,summary,label,[role=button],[role=link],[role=menuitem],[role=tab],[role=checkbox],[role=radio],[role=option],[role=switch],[role=combobox]'
  document.addEventListener(
    'click',
    (e) => {
      if (!st?.practice || gone || !target) return
      const s = st.steps[st.index]
      if (!s || s.kind !== 'step') return
      const path = e.composedPath()
      if (path.includes(host) || path.includes(target) || (detour && path.includes(detour))) return
      const el = (path[0] instanceof Element ? path[0] : null)?.closest(INTERACTIVE)
      if (!el || (el instanceof HTMLLabelElement && el.control === target)) return
      const name = labelFor(el) || el.textContent?.trim().slice(0, 40) || 'that'
      if (isFinalAction(name)) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
      st = { ...st, mistakes: (st.mistakes ?? 0) + 1 }
      void send({ type: 'guide-mistake' })
      say(`Not quite: that was “${name}”. Try again, or press Show me.`, 'warn')
    },
    true,
  )

  const button = (label: string, run: () => void, primary = false) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = primary ? 'b p' : 'b'
    b.textContent = label
    b.addEventListener('click', run)
    return b
  }
  const show = (el: HTMLElement, on: boolean) => el.classList.toggle('hidden', !on)
  const say = (text: string, tone: '' | 'warn' | 'good' = '') => {
    note.textContent = text
    note.className = `note${tone ? ' ' + tone : ''}`
    show(note, true)
  }

  $('.x').addEventListener('click', () => stop(true))

  function stop(tell: boolean) {
    gone = true
    cleanup()
    host.remove()
    if (tell) void send({ type: 'guide-stop' })
  }
  function cleanup() {
    cancelAnimationFrame(raf)
    window.clearInterval(poll)
    off?.()
    off = null
    target = null
    match = null
    detour = null
    ring.classList.remove('warn')
  }

  const step = () => (st ? st.steps[st.index] : undefined)
  // Move to step `index`, reporting how the step being left went.
  const go = (index: number, result?: StepHealth, skippedTo?: number[]) => {
    if (!st) return
    const from = st.index
    cleanup()
    revealed = false
    const results = { ...(st.results ?? {}) }
    if (result && index > from) results[from] = result
    for (const i of skippedTo ?? []) results[i] = 'skipped'
    // Going back on purpose isn't going off track.
    st = { ...st, index, results, path: index < from ? undefined : st.path }
    void send({ type: 'guide-advance', index, from, result: index > from ? result : undefined, skipped: skippedTo, back: index < from })
    render()
  }
  const next = (result?: StepHealth) => st && go(st.index + 1, result)

  // Card next to the element (below if there's room, else above), or centred.
  function place(r: DOMRect | null) {
    const cw = card.offsetWidth
    const ch = card.offsetHeight
    let x = (innerWidth - cw) / 2
    let y = innerHeight - ch - 24
    if (r) {
      x = Math.min(innerWidth - cw - 12, Math.max(12, r.left + r.width / 2 - cw / 2))
      y = r.bottom + 14 + ch < innerHeight ? r.bottom + 14 : r.top - ch - 14 >= 8 ? r.top - ch - 14 : Math.min(innerHeight - ch - 12, r.bottom + 14)
    }
    card.style.left = `${Math.round(x)}px`
    card.style.top = `${Math.round(y)}px`
  }
  function spotlight(r: DOMRect | null) {
    show(dim, !r)
    show(hole, !!r)
    show(ring, !!r)
    if (r) {
      const pad = 6
      for (const el of [hole, ring]) {
        el.style.left = `${r.left - pad}px`
        el.style.top = `${r.top - pad}px`
        el.style.width = `${r.width + pad * 2}px`
        el.style.height = `${r.height + pad * 2}px`
      }
    }
    place(r)
  }

  // Keep the spotlight on the element as the page scrolls or moves.
  function follow() {
    if (gone) return
    if (target && !target.isConnected) {
      // The page re-drew it: look again.
      target = null
      match = null
      lookingSince = Date.now()
    }
    const el = detour?.isConnected ? detour : target
    if (quietPractice() && st?.steps[st.index]?.kind === 'step') {
      // Practice: no spotlight and no dimming until they ask for a hint.
      show(dim, false)
      show(hole, false)
      show(ring, false)
      place(null)
    } else spotlight(el ? el.getBoundingClientRect() : null)
    raf = requestAnimationFrame(follow)
  }

  const path = (p: string) => p.replace(/\/$/, '')
  const samePage = (url?: string) => {
    if (!url) return true
    try {
      const u = new URL(url)
      return (u.origin === location.origin || !!st?.anyOrigin) && path(u.pathname) === path(location.pathname)
    } catch {
      return true
    }
  }
  const otherSite = (url?: string) => {
    try {
      return !!url && !st?.anyOrigin && new URL(url).origin !== location.origin ? new URL(url).host : null
    } catch {
      return null
    }
  }

  function fill(s: GuideMeStep) {
    count.textContent = `Step ${st!.index + 1} of ${st!.steps.length}`
    show(practiceTag, !!st!.practice)
    title.textContent = s.title
    detail.textContent = s.detail ?? ''
    show(detail, !!s.detail)
    flash.textContent = carry ?? ''
    show(flash, !!carry)
    carry = null
    show(note, false)
    show(shot, false)
    progress.style.width = `${Math.round((st!.index / st!.steps.length) * 100)}%`
    buttons.replaceChildren()
    if (st!.index > 0) buttons.append(button('Back', () => go(st!.index - 1)))
  }

  // When the element can't be found: show the step's screenshot so they can
  // spot it themselves, and let them carry on.
  async function fallback(s: GuideMeStep) {
    const elsewhere = !samePage(s.url)
    say(elsewhere ? (held ? 'In practice the last step wasn’t sent, so the app didn’t move on. This step is on another page.' : 'This step is on another page.') : "StepCrumb can't find this on the page. Look for it in the picture, then carry on.")
    if (s.hasImage) {
      const src = (await send({ type: 'guide-image', index: st!.index })) as string | null
      if (src && !gone && step() === s) {
        shot.src = src
        show(shot, true)
      }
    }
    buttons.replaceChildren()
    if (st!.index > 0) buttons.append(button('Back', () => go(st!.index - 1)))
    buttons.append(button('Skip', () => next(elsewhere ? 'skipped' : 'missed')))
    if (elsewhere) buttons.append(button('Go to the page', () => (location.href = s.url!), true))
    else buttons.append(button("I've done this", () => next('missed'), true))
    place(null)
  }

  // Went somewhere else while on a step: offer to go back to it.
  function offTrack(s: GuideMeStep) {
    say(`That opened “${document.title || location.pathname}”. This step is on another page. Go back to it?`, 'warn')
    buttons.replaceChildren()
    if (st!.index > 0) buttons.append(button('Back', () => go(st!.index - 1)))
    buttons.append(button('Skip', () => next('skipped')))
    buttons.append(
      button(
        'Go to the page',
        () => {
          if (history.length > 1 && document.referrer && samePage(document.referrer)) history.back()
          else location.href = s.url!
        },
        true,
      ),
    )
    spotlight(null)
  }

  // How the step went, and repair its clues if the element has changed.
  function outcome(): StepHealth {
    const s = step()
    if (!s?.locator || !match) return 'found'
    const fixed = confidentMatch(match) ? repairedLocator(s.locator, match.locator) : null
    if (!fixed) return 'found'
    void send({ type: 'guide-heal', index: st!.index, locator: fixed })
    return 'repaired'
  }

  // Empty required fields in the target's form, which the app would reject.
  function emptyRequired(el: Element): HTMLElement[] {
    const form = el.closest('form')
    if (!form) return []
    return [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')].filter((f) => {
      if (!(f.required || f.getAttribute('aria-required') === 'true') || f.disabled) return false
      const r = f.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return false
      if (f instanceof HTMLInputElement && (f.type === 'checkbox' || f.type === 'radio')) return f.type === 'checkbox' && !f.checked
      return !f.value.trim()
    })
  }
  const fieldName = (f: Element) => labelFor(f) || (f as HTMLInputElement).name || 'this field'

  // Moves on when the learner does what the step says, on the found element.
  function listen(s: GuideMeStep, el: Element) {
    const ac = new AbortController()
    const opts = { capture: true, signal: ac.signal } as const
    const inside = (e: Event) => e.composedPath().includes(el)
    if (s.action === 'type') {
      const done = () => {
        const v = (el as HTMLInputElement).value
        if (v !== undefined && v !== '') next(outcome())
      }
      document.addEventListener('change', (e) => inside(e) && done(), opts)
      document.addEventListener('focusout', (e) => inside(e) && done(), opts)
      document.addEventListener('keydown', (e) => inside(e) && (e as KeyboardEvent).key === 'Enter' && done(), opts)
    } else if (s.action === 'select') {
      document.addEventListener(
        'change',
        (e) => {
          if (!inside(e)) return
          const sel = el as HTMLSelectElement
          const chose = sel.selectedOptions?.[0]?.text?.trim() ?? sel.value
          if (s.expected && chose && chose !== s.expected) {
            // A different choice than the guide's: say so, and let them decide.
            const result = outcome()
            say(`The guide picked “${s.expected}”; you picked “${chose}”.`, 'warn')
            buttons.replaceChildren(
              button('Change it', () => {
                show(note, false)
                sel.focus()
              }),
              button('Keep mine', () => next(result), true),
            )
            return
          }
          next(outcome())
        },
        opts,
      )
    } else {
      const final = !!st?.practice && isFinalAction(s.locator?.label || s.locator?.text || s.title)
      let anyway = false
      // Practice: stop the press before the app sees it, at every stage.
      const stopIt = (e: Event) => {
        if (!final || !inside(e)) return
        e.preventDefault()
        e.stopImmediatePropagation()
      }
      if (final) for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) document.addEventListener(t, stopIt, opts)
      document.addEventListener(
        'click',
        (e) => {
          if (!inside(e)) return
          // Empty required fields: point at the first one before the app rejects the form.
          const empty = !anyway && emptyRequired(el)
          if (empty && empty.length) {
            e.preventDefault()
            e.stopImmediatePropagation()
            detour = empty[0]
            ring.classList.add('warn')
            say(`Fill in “${fieldName(empty[0])}” before ${s.locator?.label ? `“${s.locator.label}”` : 'you carry on'}.`, 'warn')
            buttons.replaceChildren(
              button('Do it anyway', () => {
                anyway = true
                detour = null
                ring.classList.remove('warn')
                show(note, false)
              }),
            )
            empty[0].focus()
            empty[0].addEventListener(
              'input',
              () => {
                if (emptyRequired(el).length) return
                detour = null
                ring.classList.remove('warn')
                show(note, false)
              },
              { signal: ac.signal },
            )
            return
          }
          const result = outcome()
          if (final) {
            e.preventDefault()
            e.stopImmediatePropagation()
            held = true
            carry = `Practice: “${s.locator?.label || 'that'}” wasn’t sent, so nothing changed.`
            setTimeout(() => next(result), 0)
            return
          }
          held = false
          setTimeout(() => next(result), 0)
        },
        opts,
      )
      if (final) document.addEventListener('submit', (e) => (e.preventDefault(), e.stopImmediatePropagation()), opts)
    }
    off = () => ac.abort()
  }

  // Already done: the field already holds what the guide typed or chose, or
  // the checkbox is already as the guide left it.
  function alreadyDone(s: GuideMeStep, el: Element): boolean {
    if (s.action === 'type' && s.expected !== undefined) return (el as HTMLInputElement).value === s.expected
    if (s.action === 'select' && s.expected) return ((el as HTMLSelectElement).selectedOptions?.[0]?.text?.trim() ?? '') === s.expected
    if (s.checked !== undefined && el instanceof HTMLInputElement && el.type === 'checkbox') return el.checked === s.checked
    return false
  }

  // A later step (on this page, before any page change) whose element is on screen.
  function aheadOnPage(): number | null {
    if (!st) return null
    for (let i = st.index + 1; i < Math.min(st.steps.length, st.index + 4); i++) {
      const s = st.steps[i]
      if (s.kind !== 'step' || s.action === 'navigate' || !samePage(s.url)) return null
      if (s.locator && findMatch(s.locator, labelFor)) return i
    }
    return null
  }

  // Steps already done when the guide got to them: not held against a learner.
  function markAlready(indices: number[]) {
    if (!st) return
    st = { ...st, already: [...new Set([...(st.already ?? []), ...indices])] }
    void send({ type: 'guide-already', indices })
  }

  // Practice: a hint. The spotlight shows where to go, and it's counted.
  function showMe(s: GuideMeStep) {
    if (!st || step() !== s) return
    revealed = true
    if (!(st.hints ?? []).includes(st.index)) {
      st = { ...st, hints: [...(st.hints ?? []), st.index] }
      void send({ type: 'guide-hint', index: st.index })
    }
    for (const b of buttons.querySelectorAll('button')) if (b.textContent === 'Show me') b.remove()
    if (!target) say('Looking for it on the page…')
  }

  // Practice starts here: who's practising, and how it works.
  function askName() {
    spotlight(null)
    show(dim, false)
    count.textContent = 'Practice'
    show(practiceTag, true)
    title.textContent = `Practise "${st!.title}"`
    detail.textContent = 'Do each step yourself. StepCrumb watches, and shows you where to go only if you press Show me. Save, Submit, Pay and similar buttons are stopped, so nothing is changed.'
    show(detail, true)
    show(flash, false)
    show(note, false)
    show(shot, false)
    progress.style.width = '0%'
    const input = document.createElement('input')
    input.className = 'name'
    input.placeholder = 'Your name (for your result)'
    input.setAttribute('aria-label', 'Your name')
    chrome.storage.local.get('learnerName').then(({ learnerName }) => {
      if (typeof learnerName === 'string' && !input.value) input.value = learnerName
    }, () => {})
    const begin = () => {
      if (!st) return
      const learner = input.value.trim() || 'Someone'
      void chrome.storage.local.set({ learnerName: input.value.trim() }).catch(() => {})
      input.remove()
      off = null
      st = { ...st, learner, startedAt: Date.now(), hints: [], mistakes: 0 }
      void send({ type: 'guide-practice-start', learner })
      render()
    }
    input.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') begin()
    })
    buttons.replaceChildren(button('Start', begin, true))
    detail.after(input)
    place(null)
    setTimeout(() => input.focus(), 50)
    // The input goes when practice starts.
    const removeInput = () => input.remove()
    off = removeInput
  }

  function render() {
    if (!st || gone) return
    const s = step()
    if (!s) {
      // Finished.
      cleanup()
      spotlight(null)
      show(dim, false)
      count.textContent = st.practice ? 'Practice result' : 'Guide me'
      show(practiceTag, !!st.practice)
      title.textContent = st.practice ? `You finished "${st.title}".` : `Done! You completed "${st.title}".`
      show(detail, false)
      flash.textContent = carry ?? ''
      show(flash, !!carry)
      carry = null
      show(note, false)
      show(shot, false)
      progress.style.width = '100%'
      buttons.replaceChildren(button('Close', () => stop(true), true))
      place(null)
      const guideTitle = st.title
      void send({ type: 'guide-finish' }).then((a) => {
        const attempt = a as PracticeAttempt | null
        if (!attempt || gone) return
        say(resultLine(attempt).replace('on their own', 'on your own'), attempt.onOwn === attempt.steps && !attempt.mistakes ? 'good' : '')
        buttons.replaceChildren(
          button('Download certificate', () => {
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob([certificateHtml(attempt, guideTitle)], { type: 'text/html' }))
            a.download = `Practice result - ${guideTitle.replace(/[\\/:*?"<>|]/g, '')}.html`
            a.click()
            setTimeout(() => URL.revokeObjectURL(a.href), 4000)
          }),
          button('Close', () => stop(true), true),
        )
        place(null)
      })
      return
    }
    if (!host.isConnected) document.documentElement.appendChild(host)
    // Practice starts by asking who's practising (for the result).
    if (st.practice && !st.learner) return askName()
    fill(s)

    // Notes and headings: just read and go on.
    if (s.kind !== 'step') {
      spotlight(null)
      buttons.append(button('Next', () => next(), true))
      place(null)
      return
    }
    // Opening a page: done when they're on it.
    if (s.action === 'navigate' || s.action === 'key') {
      spotlight(null)
      if (s.action === 'key') {
        const ac = new AbortController()
        document.addEventListener('keydown', (e) => e.key === 'Enter' && setTimeout(() => next('found'), 0), { capture: true, signal: ac.signal })
        off = () => ac.abort()
        buttons.append(button('Skip', () => next('skipped')))
        place(null)
        return
      }
      if (samePage(s.url)) return next()
      // Recorded on another site (say the test system) than this one: they can
      // go there, or play it here.
      const site = otherSite(s.url)
      if (site) {
        say(`This guide was recorded on ${site}. You're on ${location.host}.`)
        buttons.append(
          button('Stay here', () => {
            if (!st) return
            st = { ...st, anyOrigin: true }
            void send({ type: 'guide-any-origin' })
            next()
          }),
          button(`Go to ${site}`, () => (location.href = s.url!), true),
        )
        place(null)
        return
      }
      buttons.append(button('Go to the page', () => (location.href = s.url!), true))
      place(null)
      return
    }

    // Left the step's page (a wrong click opened something else): offer to go back.
    if (st.path && path(st.path) !== path(location.pathname) && !samePage(s.url) && !held) return offTrack(s)
    // On the step's page: remember it, to notice leaving it.
    if (samePage(s.url) && st.path !== location.pathname) {
      st = { ...st, path: location.pathname }
      void send({ type: 'guide-path', path: location.pathname })
    }

    if (st.practice) buttons.append(button('Show me', () => showMe(s)))
    buttons.append(button('Skip', () => next('skipped')))
    lookingSince = Date.now()
    lastBusy = Date.now()
    const pageAtStart = location.pathname
    let fellBack = false
    let waiting = false
    const look = () => {
      if (gone || step() !== s) return
      // A single-page app moved to another page while on this step.
      if (location.pathname !== pageAtStart && st?.path && !samePage(s.url) && !target) {
        window.clearInterval(poll)
        return offTrack(s)
      }
      if (target?.isConnected) return
      const m = s.locator ? findMatch(s.locator, labelFor) : null
      if (m) {
        target = m.el
        match = m
        if (fellBack || waiting) {
          fill(s)
          if (st?.practice && !revealed) buttons.append(button('Show me', () => showMe(s)))
          buttons.append(button('Skip', () => next('skipped')))
          fellBack = false
          waiting = false
        }
        // Already done (the field holds the guide's value): tick it and go on.
        if (alreadyDone(s, m.el)) {
          window.clearInterval(poll)
          markAlready([st!.index])
          carry = `Step ${st!.index + 1} was already done.`
          const result = outcome()
          say('Already done ✓', 'good')
          setTimeout(() => step() === s && next(result), 700)
          return
        }
        off?.()
        listen(s, m.el)
        held = false
        const r = m.el.getBoundingClientRect()
        if (r.top < 0 || r.bottom > innerHeight) m.el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        return
      }
      const now = Date.now()
      if (pageBusy()) lastBusy = now
      const quiet = now - lastBusy >= QUIET_MS
      // You're already past this click: a later step's element is showing.
      if (s.action === 'click' && quiet && now - lookingSince > AHEAD_AFTER_MS && samePage(s.url)) {
        const ahead = aheadOnPage()
        if (ahead !== null) {
          window.clearInterval(poll)
          const skipped = Array.from({ length: ahead - st!.index }, (_, k) => st!.index + k)
          markAlready(skipped)
          carry = skipped.length === 1 ? `You're already here, so step ${st!.index + 1} was skipped.` : `You're already here, so steps ${st!.index + 1}–${ahead} were skipped.`
          go(ahead, undefined, skipped)
          return
        }
      }
      if (fellBack) return
      // On the wrong page there's nothing to wait for (beyond a moment for a single-page app to switch).
      const elsewhere = !samePage(s.url)
      if ((now - lookingSince > FIND_FOR_MS && (quiet || elsewhere)) || now - lookingSince > WAIT_MAX_MS || (elsewhere && held)) {
        fellBack = true
        waiting = false
        void fallback(s)
      } else if (!quiet && now - lookingSince > 1200 && !waiting && samePage(s.url)) {
        waiting = true
        say('Waiting for the page to load…')
        place(null)
      }
    }
    look()
    poll = window.setInterval(look, 300)
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(follow)
  }

  return {
    run(state: GuideMeState) {
      gone = false
      cleanup()
      st = state
      render()
    },
    stop: () => stop(false),
    owns: (n: Node) => n === host || host.contains(n),
  }
}
