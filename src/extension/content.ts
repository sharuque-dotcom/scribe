// Runs in every page. While recording, it turns clicks, typing, dropdown
// choices and Enter presses into captured steps, and shows a small control bar.
import { estimateOrigin, monitorOffset, toVideoPoint, toVideoRect, type ScreenGeom } from '../shared/coords'
import { cleanLabel, looksSensitive } from '../shared/describe'
import type { CapturedEvent, NRect, RecorderState, StepAction, TargetInfo } from '../shared/types'

declare global {
  interface Window {
    __scribeCaptureLoaded?: boolean
  }
}

if (!window.__scribeCaptureLoaded && window.top === window) {
  window.__scribeCaptureLoaded = true
  init()
}

function init() {
  let state: RecorderState = { recording: false, paused: false, count: 0 }
  // Values already recorded per field, so a change + Enter doesn't make two steps.
  const recordedValues = new WeakMap<Element, string>()

  const bar = createBar()
  // Identifies this page (document), so the background can tell whether a
  // screenshot shows the page an event happened on.
  const pageId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

  // A counter that goes up whenever the page visibly changes. Every event and
  // every screenshot carries it, so the background can pick the screenshot that
  // shows the page exactly as it was when the user acted (not a moment later).
  let seq = 0
  // When the page has been quiet for a moment after a change, ask for a spare
  // screenshot. At normal speed, the state the user acts on is then already captured.
  let idleTimer = 0
  const scheduleIdle = () => {
    window.clearTimeout(idleTimer)
    if (!state.recording || state.paused || state.mode === 'video') return
    idleTimer = window.setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'preshot', page: pageId, seq }).catch(() => {})
    }, 300)
  }
  const bump = () => {
    seq++
    scheduleIdle()
  }
  new MutationObserver((records) => {
    // Our own control bar changing doesn't count.
    if (records.some((r) => !bar.owns(r.target))) bump()
  }).observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'open', 'hidden', 'checked', 'value', 'selected', 'disabled', 'aria-expanded', 'aria-selected', 'aria-hidden', 'aria-checked', 'src'],
  })
  for (const type of ['input', 'change']) document.addEventListener(type, bump, true)
  addEventListener('scroll', bump, { capture: true, passive: true })

  let started = false
  const apply = (s: RecorderState) => {
    state = s
    bar.update(s)
    if (s.recording && !started) {
      started = true
      scheduleIdle()
    }
  }

  chrome.runtime.sendMessage({ type: 'hello' }).then(
    (s: RecorderState | undefined) => s && apply(s),
    () => {},
  )
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg?.type === 'state') apply(msg.state as RecorderState)
    if (msg?.type === 'prepareCapture') {
      // Hide the bar and reply once a frame without it has been painted.
      // Also report secret fields as they are right now, since the user may
      // have typed since the click.
      bar.hold(500)
      requestAnimationFrame(() => requestAnimationFrame(() => reply({ redactRects: sensitiveRects(), page: pageId, seq })))
      return true
    }
  })

  const active = () => state.recording && !state.paused

  // ---------- positions in the video (window / entire-screen recordings) ----------
  // Mouse events say exactly where the page sits on screen; until one arrives,
  // estimate it from the window size.
  let origin: { x: number; y: number } | null = null
  const noteOrigin = (e: MouseEvent) => (origin = { x: e.screenX - e.clientX, y: e.screenY - e.clientY })
  const geom = (): ScreenGeom => {
    const s = screen as Screen & { availLeft?: number; availTop?: number }
    return { winX: screenX, winY: screenY, winW: outerWidth, winH: outerHeight, scrX: monitorOffset(s.availLeft, s.width), scrY: monitorOffset(s.availTop, s.height), scrW: s.width, scrH: s.height }
  }
  const desktop = () => (state.rec && state.rec.source !== 'tab' ? state.rec.source : null)
  const pageOrigin = () => origin ?? estimateOrigin(geom(), innerWidth, innerHeight)
  // A point given in page pixels → position in the video frame.
  const vPoint = (cx: number, cy: number) => {
    const src = desktop()
    if (!src) return undefined
    const o = pageOrigin()
    return toVideoPoint(src, o.x + cx, o.y + cy, geom())
  }
  // A rectangle given as 0..1 of the page → position in the video frame.
  const vRectFromPage = (r: NRect | undefined) => {
    const src = desktop()
    if (!src || !r) return undefined
    const o = pageOrigin()
    return toVideoRect(src, o.x + r.x * innerWidth, o.y + r.y * innerHeight, o.x + (r.x + r.w) * innerWidth, o.y + (r.y + r.h) * innerHeight, geom())
  }

  // While video is recording, send the mouse path (about 30 positions a second)
  // and where secret fields are, so the video can show a smooth cursor and blur them.
  let samples: { t: number; x: number; y: number }[] = []
  let lastSample = 0
  document.addEventListener(
    'pointermove',
    (e) => {
      noteOrigin(e)
      if (!active() || !state.video) return
      const now = Date.now()
      if (now - lastSample < 30) return
      lastSample = now
      const v = vPoint(e.clientX, e.clientY)
      samples.push({ t: now, x: v ? v.x : e.clientX / innerWidth, y: v ? v.y : e.clientY / innerHeight })
    },
    { capture: true, passive: true },
  )
  window.setInterval(() => {
    if (!active() || !state.video) return
    const batch = samples
    samples = []
    const rects = sensitiveRects().map((r) => vRectFromPage(r) ?? r)
    chrome.runtime.sendMessage({ type: 'cursor', samples: batch, rects, at: Date.now() }).catch(() => {})
  }, 500)

  async function send(event: CapturedEvent) {
    bar.begin()
    try {
      // Send right away: a click that navigates may unload this page any moment.
      await chrome.runtime.sendMessage({ type: 'capture', event })
    } catch {
      // Extension reloaded or page unloading; nothing to do.
    } finally {
      bar.end()
    }
  }

  // Clicking into a text box or dropdown usually leads to typing or choosing a
  // value, which becomes the step. The click is only kept if nothing follows,
  // so it doesn't cost a screenshot of its own.
  let pendingField: { el: Element; event: CapturedEvent } | null = null

  // Record what happened in a field the user is leaving or submitting.
  function settleField(el: Element) {
    if (isTextField(el) && recordTyping(el)) return
    if (pendingField?.el === el) {
      const { event } = pendingField
      pendingField = null
      void send(event)
    }
  }

  document.addEventListener(
    'pointerdown',
    (e) => {
      noteOrigin(e)
      if (!active() || !e.isTrusted || e.button !== 0) return
      const path = e.composedPath()
      // Browsers report typed text on blur, which comes after this click.
      // Record it now so the steps stay in the order they happened.
      const focused = document.activeElement
      if (focused && !path.includes(focused)) settleField(focused)
      if (pendingField && !path.includes(pendingField.el)) settleField(pendingField.el)
      const raw = path[0]
      if (!(raw instanceof Element) || bar.contains(e)) return
      const el = interactiveAncestor(raw)
      const event = buildEvent('click', el, { click: { x: e.clientX / innerWidth, y: e.clientY / innerHeight } })
      if (isTextField(el) || el instanceof HTMLSelectElement) {
        if (pendingField?.el !== el) pendingField = { el, event }
        return
      }
      void send(event)
    },
    true,
  )

  document.addEventListener(
    'change',
    (e) => {
      if (!active() || !e.isTrusted) return
      const el = e.target
      if (el instanceof HTMLSelectElement) {
        if (pendingField?.el === el) pendingField = null
        const value = el.selectedOptions[0]?.text ?? el.value
        void send(buildEvent('select', el, { value }))
      } else if (isTextField(el)) {
        recordTyping(el)
      }
    },
    true,
  )

  document.addEventListener(
    'focusout',
    (e) => {
      if (active() && e.target instanceof Element && pendingField?.el === e.target) settleField(e.target)
    },
    true,
  )

  document.addEventListener(
    'keydown',
    (e) => {
      if (!active() || !e.isTrusted || e.key !== 'Enter' || e.isComposing) return
      const el = e.target
      if (el instanceof HTMLTextAreaElement) return
      if (el instanceof Element) settleField(el)
      void send(buildEvent('key', el instanceof Element ? el : document.body, { key: 'Enter' }))
    },
    true,
  )

  // Returns true if a typing step was recorded.
  function recordTyping(el: HTMLInputElement | HTMLTextAreaElement): boolean {
    if ((recordedValues.get(el) ?? el.defaultValue) === el.value) return false
    recordedValues.set(el, el.value)
    let click: CapturedEvent['click']
    let t: number | undefined
    if (pendingField?.el === el) {
      click = pendingField.event.click
      // In the video, the caption appears when they clicked into the field.
      t = pendingField.event.t
      pendingField = null
    }
    const sensitive = looksSensitive({
      type: el.type,
      name: el.name,
      id: el.id,
      autocomplete: el.getAttribute('autocomplete') ?? undefined,
    })
    void send(buildEvent('type', el, { value: sensitive ? '' : el.value, sensitive, click, ...(t ? { t } : {}) }))
    return true
  }

  function buildEvent(
    action: StepAction,
    el: Element,
    extra: Partial<CapturedEvent>,
  ): CapturedEvent {
    const target = describeTarget(el)
    const targetRect = action === 'key' ? undefined : viewportRect(el)
    const labelRect = targetRect ? nearbyLabelRect(el, targetRect) : undefined
    const click = extra.click
    return {
      action,
      target,
      targetRect,
      labelRect,
      vClick: click ? vPoint(click.x * innerWidth, click.y * innerHeight) : undefined,
      vRect: vRectFromPage(targetRect),
      vLabel: vRectFromPage(labelRect),
      redactRects: sensitiveRects(),
      elementKey: elementKey(el),
      url: location.href,
      page: pageId,
      // The page's state just before this action took effect.
      seq,
      pageTitle: document.title,
      t: Date.now(),
      ...extra,
    }
  }
}

// ---------- element helpers ----------

const INTERACTIVE =
  'a[href],button,input,select,textarea,summary,label,[role=button],[role=link],[role=tab],[role=menuitem],[role=menuitemradio],[role=menuitemcheckbox],[role=checkbox],[role=switch],[role=radio],[role=option],[role=combobox],[role=textbox],[contenteditable=""],[contenteditable=true]'

function interactiveAncestor(el: Element): Element {
  const hit = el.closest(INTERACTIVE)
  if (hit) {
    // A label wrapping a checkbox should describe the checkbox.
    if (hit instanceof HTMLLabelElement && hit.control) return hit.control
    return hit
  }
  // Fall back to the nearest element with a short, readable text.
  let cur: Element | null = el
  for (let i = 0; cur && i < 4; i++, cur = cur.parentElement) {
    const t = (cur as HTMLElement).innerText?.trim()
    if (t && t.length <= 60) return cur
  }
  return el
}

function viewportRect(el: Element): NRect | undefined {
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return undefined
  return { x: r.left / innerWidth, y: r.top / innerHeight, w: r.width / innerWidth, h: r.height / innerHeight }
}

// The visible label for a form field, if it sits close to the field.
// Used so zoomed screenshots show the field name as well as its value.
function nearbyLabelRect(el: Element, field: NRect): NRect | undefined {
  let label: Element | null = null
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    label = el.labels?.[0] ?? null
  }
  const ref = el.getAttribute('aria-labelledby')?.split(/\s+/)[0]
  if (!label && ref) label = document.getElementById(ref)
  if (!label) return undefined
  const r = viewportRect(label)
  if (!r) return undefined
  // Ignore labels far away from the field (e.g. a heading used as a label).
  const dx = Math.abs(r.x + r.w / 2 - (field.x + field.w / 2))
  const dy = Math.abs(r.y + r.h / 2 - (field.y + field.h / 2))
  return dx < 0.25 && dy < 0.15 ? r : undefined
}

function isTextField(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) return true
  if (!(el instanceof HTMLInputElement)) return false
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'range', 'color'].includes(el.type)
}

function textOf(id: string | null): string {
  if (!id) return ''
  return id
    .split(/\s+/)
    .map((ref) => document.getElementById(ref)?.textContent ?? '')
    .join(' ')
}

function fieldLabel(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const fromLabels = el.labels && el.labels.length ? Array.from(el.labels).map((l) => l.innerText).join(' ') : ''
  return (
    el.getAttribute('aria-label') ||
    textOf(el.getAttribute('aria-labelledby')) ||
    fromLabels ||
    el.getAttribute('placeholder') ||
    el.getAttribute('title') ||
    el.getAttribute('name') ||
    ''
  )
}

function describeTarget(el: Element): TargetInfo {
  const tag = el.tagName.toLowerCase()
  const role = el.getAttribute('role') ?? undefined
  let label = ''
  let inputType: string | undefined
  let checked: boolean | undefined

  if (el instanceof HTMLInputElement) {
    inputType = el.type
    if (['submit', 'button', 'reset'].includes(el.type)) label = el.value || el.getAttribute('aria-label') || ''
    else label = fieldLabel(el)
    if (el.type === 'checkbox' || el.type === 'radio') checked = el.checked
  } else if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    label = fieldLabel(el)
  } else {
    label =
      el.getAttribute('aria-label') ||
      textOf(el.getAttribute('aria-labelledby')) ||
      (el as HTMLElement).innerText ||
      el.getAttribute('title') ||
      el.querySelector('img[alt]')?.getAttribute('alt') ||
      el.querySelector('svg title')?.textContent ||
      ''
    if (role === 'checkbox' || role === 'switch') checked = el.getAttribute('aria-checked') === 'true'
  }
  // Use the first line of long labels (e.g. a card with a heading and body).
  label = cleanLabel(label.split('\n').find((l) => l.trim()) ?? '')
  return { tag, role, inputType, label, checked }
}

function elementKey(el: Element): string {
  const parts = [el.tagName, el.id, el.getAttribute('name') ?? '']
  if (!el.id && !el.getAttribute('name')) {
    // Position among siblings keeps the key stable for unnamed fields.
    let path = ''
    let cur: Element | null = el
    for (let i = 0; cur && i < 5; i++, cur = cur.parentElement) {
      const idx = cur.parentElement ? Array.from(cur.parentElement.children).indexOf(cur) : 0
      path = `${cur.tagName}:${idx}/` + path
    }
    parts.push(path)
  }
  return parts.join('|')
}

// Password and other secret fields get blurred automatically in every screenshot.
function sensitiveRects(): NRect[] {
  const out: NRect[] = []
  document.querySelectorAll<HTMLInputElement>('input').forEach((el) => {
    const sensitive = looksSensitive({
      type: el.type,
      name: el.name,
      id: el.id,
      autocomplete: el.getAttribute('autocomplete') ?? undefined,
    })
    if (!sensitive || !el.value) return
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0 || r.bottom < 0 || r.top > innerHeight) return
    out.push({ x: r.left / innerWidth, y: r.top / innerHeight, w: r.width / innerWidth, h: r.height / innerHeight })
  })
  return out
}

// ---------- recording control bar ----------

function createBar() {
  const host = document.createElement('div')
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;bottom:20px;right:20px;'
  const root = host.attachShadow({ mode: 'closed' })
  root.innerHTML = `
    <style>
      .bar{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 4px;border-radius:999px;
        background:#111827;color:#fff;font:500 13px/1.2 Inter,-apple-system,Segoe UI,Roboto,sans-serif;
        box-shadow:0 8px 30px rgba(0,0,0,.35);user-select:none}
      .grip{cursor:grab;padding:6px 2px 6px 8px;color:#6b7280;font-size:14px;line-height:1;letter-spacing:-1px}
      .grip:active{cursor:grabbing}
      .dot{width:10px;height:10px;flex:none;border-radius:50%;background:#ef4444;animation:p 1.4s infinite}
      .paused .dot{background:#f59e0b;animation:none}
      @keyframes p{50%{opacity:.35}}
      .time{font-variant-numeric:tabular-nums;font-weight:600;min-width:38px}
      .label{color:#cbd5e1;white-space:nowrap}
      button{all:unset;cursor:pointer;padding:6px 12px;border-radius:999px;background:#374151;color:#fff;font-weight:600;white-space:nowrap}
      button:hover{background:#4b5563}
      button:focus-visible{outline:2px solid #a5b4fc;outline-offset:1px}
      .stop{background:#ef4444}.stop:hover{background:#dc2626}
      .discard{background:transparent;color:#9ca3af;padding:6px 8px}.discard:hover{background:#374151;color:#fff}
      .discard.sure{background:#7f1d1d;color:#fff}
      .min{background:transparent;color:#9ca3af;padding:6px 9px}.min:hover{background:#374151;color:#fff}
      .small .label,.small .pause,.small .discard,.small .stop{display:none}
    </style>
    <div class="bar" part="bar" role="toolbar" aria-label="StepCrumb capture">
      <span class="grip" title="Drag to move" aria-hidden="true">⋮⋮</span>
      <span class="dot"></span><span class="time">0:00</span><span class="label">0 steps</span>
      <button class="pause" type="button">Pause</button>
      <button class="discard" type="button" title="Delete this capture">Discard</button>
      <button class="stop" type="button">Finish</button>
      <button class="min" type="button" title="Make smaller" aria-label="Make smaller">–</button>
    </div>`
  const barEl = root.querySelector('.bar') as HTMLElement
  const label = root.querySelector('.label') as HTMLElement
  const time = root.querySelector('.time') as HTMLElement
  const pauseBtn = root.querySelector('.pause') as HTMLButtonElement
  const discardBtn = root.querySelector('.discard') as HTMLButtonElement
  const minBtn = root.querySelector('.min') as HTMLButtonElement
  root.querySelector('.stop')!.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'stop' }))
  pauseBtn.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'togglePause' }))

  // Discard asks once more on the bar itself (no pop-up over the page).
  let sureTimer = 0
  discardBtn.addEventListener('click', () => {
    if (discardBtn.classList.contains('sure')) {
      window.clearTimeout(sureTimer)
      void chrome.runtime.sendMessage({ type: 'discard' })
      return
    }
    discardBtn.classList.add('sure')
    discardBtn.textContent = 'Delete it?'
    sureTimer = window.setTimeout(() => {
      discardBtn.classList.remove('sure')
      discardBtn.textContent = 'Discard'
    }, 3500)
  })

  // Make smaller: just the dot, the time and the button to open it again.
  minBtn.addEventListener('click', () => {
    const small = barEl.classList.toggle('small')
    minBtn.textContent = small ? '+' : '–'
    minBtn.title = small ? 'Show controls' : 'Make smaller'
    minBtn.setAttribute('aria-label', minBtn.title)
  })

  // Drag by the grip; the position is kept for the rest of this page.
  const grip = root.querySelector('.grip') as HTMLElement
  grip.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    grip.setPointerCapture(e.pointerId)
    const r = host.getBoundingClientRect()
    const dx = e.clientX - r.left
    const dy = e.clientY - r.top
    const move = (ev: PointerEvent) => {
      const x = Math.max(4, Math.min(innerWidth - r.width - 4, ev.clientX - dx))
      const y = Math.max(4, Math.min(innerHeight - r.height - 4, ev.clientY - dy))
      host.style.left = `${x}px`
      host.style.top = `${y}px`
      host.style.right = 'auto'
      host.style.bottom = 'auto'
    }
    const up = () => {
      grip.removeEventListener('pointermove', move)
      grip.removeEventListener('pointerup', up)
    }
    grip.addEventListener('pointermove', move)
    grip.addEventListener('pointerup', up)
  })

  // Time spent capturing, leaving out paused stretches.
  let clock: RecorderState | null = null
  const tick = () => {
    if (!clock?.startedAt) return
    const now = Date.now()
    const ms = Math.max(0, now - clock.startedAt - (clock.pausedMs ?? 0) - (clock.pausedAt ? now - clock.pausedAt : 0))
    const sec = Math.floor(ms / 1000)
    time.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
  }
  window.setInterval(() => host.isConnected && tick(), 1000)

  // The bar shows only when recording without video, no screenshot is being
  // taken, and no recent "hold" is active. A new page waits a moment before
  // showing it, so a screenshot of a page that just opened can't catch it.
  let wanted = false
  let busy = 0
  let holdUntil = performance.now() + 600
  let timer = 0
  const mount = () => {
    if (!host.isConnected) document.documentElement.appendChild(host)
  }
  const refresh = () => {
    const now = performance.now()
    const ok = wanted && busy === 0 && now >= holdUntil
    host.style.visibility = ok ? 'visible' : 'hidden'
    window.clearTimeout(timer)
    if (wanted && busy === 0 && !ok) timer = window.setTimeout(refresh, holdUntil - now + 5)
  }
  return {
    update(s: RecorderState) {
      // No bar while recording video: it would appear in the video.
      wanted = s.recording && !s.video
      if (!wanted) {
        host.remove()
        return
      }
      mount()
      barEl.classList.toggle('paused', s.paused)
      label.textContent = s.paused ? `Paused · ${s.count} step${s.count === 1 ? '' : 's'}` : `${s.count} step${s.count === 1 ? '' : 's'}`
      pauseBtn.textContent = s.paused ? 'Resume' : 'Pause'
      clock = s
      tick()
      refresh()
    },
    // A step is being sent; its screenshot may be taken any moment.
    begin() {
      busy++
      refresh()
    },
    end() {
      busy = Math.max(0, busy - 1)
      refresh()
    },
    // A screenshot is about to be taken.
    hold(ms: number) {
      holdUntil = Math.max(holdUntil, performance.now() + ms)
      refresh()
    },
    contains(e: Event) {
      return e.composedPath().includes(host)
    },
    owns(node: Node) {
      return node === host || host.contains(node)
    },
  }
}
