// Guide me, on the page: dims the page, spotlights the element for the current
// step, shows the step in a small card, and moves on when the learner does the
// step. Progress lives in the background, so it carries on across pages.
import type { GuideMeState, GuideMeStep } from '../shared/types'
import { findElement } from './locator'

type Send = (msg: object) => Promise<unknown>

const FIND_FOR_MS = 5000

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
      @keyframes pulse{50%{box-shadow:0 0 0 9px rgba(99,102,241,.12)}}
      .card{position:fixed;width:340px;max-width:calc(100vw - 24px);background:#fff;color:#0f172a;border-radius:14px;padding:14px 16px 12px;
        font:400 14px/1.45 Inter,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 18px 50px -12px rgba(15,23,42,.45);pointer-events:auto;transition:top .25s ease,left .25s ease}
      .top{display:flex;align-items:center;gap:8px;margin-bottom:6px;color:#64748b;font-size:12px;font-weight:600}
      .logo{width:16px;height:16px;border-radius:4px;background:#4f46e5;flex:none}
      .x{all:unset;cursor:pointer;margin-left:auto;color:#94a3b8;font-size:18px;line-height:1;padding:2px 4px;border-radius:6px}
      .x:hover{color:#0f172a;background:#f1f5f9}
      .title{font-size:15px;font-weight:600;line-height:1.35}
      .detail{margin-top:4px;color:#475569}
      .note{margin-top:8px;padding:8px 10px;border-radius:8px;background:#f8fafc;color:#475569;font-size:13px}
      .shot{display:block;width:100%;max-height:200px;object-fit:cover;object-position:center;margin-top:8px;border-radius:8px;border:1px solid #e2e8f0}
      .row{display:flex;gap:6px;margin-top:12px;align-items:center}
      .bar{flex:1;height:4px;border-radius:2px;background:#e2e8f0;overflow:hidden}
      .bar i{display:block;height:100%;background:#6366f1;border-radius:2px;transition:width .3s}
      button.b{all:unset;cursor:pointer;padding:6px 11px;border-radius:8px;font-weight:600;font-size:13px;background:#f1f5f9;color:#0f172a}
      button.b:hover{background:#e2e8f0}
      button.p{background:#4f46e5;color:#fff}
      button.p:hover{background:#4338ca}
      button.b:focus-visible,.x:focus-visible{outline:2px solid #a5b4fc;outline-offset:1px}
      .hidden{display:none}
    </style>
    <div class="dim hidden"></div>
    <div class="hole hidden"></div>
    <div class="ring hidden"></div>
    <div class="card" role="dialog" aria-live="polite" aria-label="StepCrumb Guide me">
      <div class="top"><span class="logo"></span><span class="count"></span><button class="x" type="button" title="Exit Guide me" aria-label="Exit Guide me">×</button></div>
      <div class="title"></div>
      <div class="detail hidden"></div>
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
  const title = $<HTMLElement>('.title')
  const detail = $<HTMLElement>('.detail')
  const note = $<HTMLElement>('.note')
  const shot = $<HTMLImageElement>('.shot')
  const progress = $<HTMLElement>('.bar i')
  const buttons = $<HTMLElement>('.buttons')

  let st: GuideMeState | null = null
  let target: Element | null = null
  let lookingSince = 0
  let raf = 0
  let poll = 0
  let off: (() => void) | null = null
  let gone = false

  const button = (label: string, run: () => void, primary = false) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = primary ? 'b p' : 'b'
    b.textContent = label
    b.addEventListener('click', run)
    return b
  }
  const show = (el: HTMLElement, on: boolean) => el.classList.toggle('hidden', !on)

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
  }

  const step = () => (st ? st.steps[st.index] : undefined)
  const go = (index: number) => {
    if (!st) return
    cleanup()
    st = { ...st, index }
    void send({ type: 'guide-advance', index })
    render()
  }
  const next = () => st && go(st.index + 1)

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
      lookingSince = Date.now()
    }
    spotlight(target ? target.getBoundingClientRect() : null)
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
    title.textContent = s.title
    detail.textContent = s.detail ?? ''
    show(detail, !!s.detail)
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
    note.textContent = elsewhere ? 'This step is on another page.' : "StepCrumb can't find this on the page. Look for it in the picture, then carry on."
    show(note, true)
    if (s.hasImage) {
      const src = (await send({ type: 'guide-image', index: st!.index })) as string | null
      if (src && !gone && step() === s) {
        shot.src = src
        show(shot, true)
      }
    }
    buttons.replaceChildren()
    if (st!.index > 0) buttons.append(button('Back', () => go(st!.index - 1)))
    buttons.append(button('Skip', next))
    if (elsewhere) buttons.append(button('Go to the page', () => (location.href = s.url!), true))
    else buttons.append(button("I've done this", next, true))
    place(null)
  }

  // Moves on when the learner does what the step says, on the found element.
  function listen(s: GuideMeStep, el: Element) {
    const ac = new AbortController()
    const opts = { capture: true, signal: ac.signal } as const
    const inside = (e: Event) => e.composedPath().includes(el)
    if (s.action === 'type') {
      const done = () => {
        const v = (el as HTMLInputElement).value
        if (v !== undefined && v !== '') next()
      }
      document.addEventListener('change', (e) => inside(e) && done(), opts)
      document.addEventListener('focusout', (e) => inside(e) && done(), opts)
      document.addEventListener('keydown', (e) => inside(e) && e.key === 'Enter' && done(), opts)
    } else if (s.action === 'select') {
      document.addEventListener('change', (e) => inside(e) && next(), opts)
    } else {
      document.addEventListener('click', (e) => inside(e) && setTimeout(next, 0), opts)
    }
    off = () => ac.abort()
  }

  function render() {
    if (!st || gone) return
    const s = step()
    if (!s) {
      // Finished.
      cleanup()
      spotlight(null)
      show(dim, false)
      count.textContent = 'Guide me'
      title.textContent = `Done! You completed "${st.title}".`
      show(detail, false)
      show(note, false)
      show(shot, false)
      progress.style.width = '100%'
      buttons.replaceChildren(button('Close', () => stop(true), true))
      place(null)
      return
    }
    if (!host.isConnected) document.documentElement.appendChild(host)
    fill(s)

    // Notes and headings: just read and go on.
    if (s.kind !== 'step') {
      spotlight(null)
      buttons.append(button('Next', next, true))
      place(null)
      return
    }
    // Opening a page: done when they're on it.
    if (s.action === 'navigate' || s.action === 'key') {
      spotlight(null)
      if (s.action === 'key') {
        const ac = new AbortController()
        document.addEventListener('keydown', (e) => e.key === 'Enter' && setTimeout(next, 0), { capture: true, signal: ac.signal })
        off = () => ac.abort()
        buttons.append(button('Skip', next))
        place(null)
        return
      }
      if (samePage(s.url)) return next()
      // Recorded on another site (say the test system) than this one: they can
      // go there, or play it here.
      const host = otherSite(s.url)
      if (host) {
        note.textContent = `This guide was recorded on ${host}. You're on ${location.host}.`
        show(note, true)
        buttons.append(
          button('Stay here', () => {
            if (!st) return
            st = { ...st, anyOrigin: true }
            void send({ type: 'guide-any-origin' })
            next()
          }),
          button(`Go to ${host}`, () => (location.href = s.url!), true),
        )
        place(null)
        return
      }
      buttons.append(button('Go to the page', () => (location.href = s.url!), true))
      place(null)
      return
    }
    buttons.append(button('Skip', next))
    lookingSince = Date.now()
    let fellBack = false
    const look = () => {
      if (gone || step() !== s) return
      if (target?.isConnected) return
      const el = s.locator ? findElement(s.locator, labelFor) : null
      if (el) {
        target = el
        if (fellBack) {
          fill(s)
          buttons.append(button('Skip', next))
          fellBack = false
        }
        off?.()
        listen(s, el)
        const r = el.getBoundingClientRect()
        if (r.top < 0 || r.bottom > innerHeight) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      } else if (!fellBack && Date.now() - lookingSince > FIND_FOR_MS) {
        fellBack = true
        void fallback(s)
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
