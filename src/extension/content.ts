// Runs in every page. While recording, it turns clicks, typing, dropdown
// choices and Enter presses into captured steps, and shows a small control bar.
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

  const apply = (s: RecorderState) => {
    state = s
    bar.update(s)
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
      bar.hide()
      requestAnimationFrame(() => requestAnimationFrame(() => reply({ redactRects: sensitiveRects() })))
      return true
    }
  })

  const active = () => state.recording && !state.paused

  async function send(event: CapturedEvent) {
    bar.hide()
    try {
      // Send right away: a click that navigates may unload this page any moment.
      await chrome.runtime.sendMessage({ type: 'capture', event })
    } catch {
      // Extension reloaded or page unloading; nothing to do.
    } finally {
      bar.show()
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
    if (pendingField?.el === el) {
      click = pendingField.event.click
      pendingField = null
    }
    const sensitive = looksSensitive({
      type: el.type,
      name: el.name,
      id: el.id,
      autocomplete: el.getAttribute('autocomplete') ?? undefined,
    })
    void send(buildEvent('type', el, { value: sensitive ? '' : el.value, sensitive, click }))
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
    return {
      action,
      target,
      targetRect,
      labelRect,
      redactRects: sensitiveRects(),
      elementKey: elementKey(el),
      url: location.href,
      pageTitle: document.title,
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
      .bar{display:flex;align-items:center;gap:10px;padding:8px 10px 8px 14px;border-radius:999px;
        background:#111827;color:#fff;font:500 13px/1.2 Inter,-apple-system,Segoe UI,Roboto,sans-serif;
        box-shadow:0 8px 30px rgba(0,0,0,.35)}
      .dot{width:10px;height:10px;border-radius:50%;background:#ef4444;animation:p 1.4s infinite}
      .paused .dot{background:#f59e0b;animation:none}
      @keyframes p{50%{opacity:.35}}
      button{all:unset;cursor:pointer;padding:6px 12px;border-radius:999px;background:#374151;color:#fff;font-weight:600}
      button:hover{background:#4b5563}
      .stop{background:#ef4444}.stop:hover{background:#dc2626}
    </style>
    <div class="bar" part="bar">
      <span class="dot"></span><span class="label">Capturing · 0 steps</span>
      <button class="pause" type="button">Pause</button>
      <button class="stop" type="button">Finish</button>
    </div>`
  const barEl = root.querySelector('.bar') as HTMLElement
  const label = root.querySelector('.label') as HTMLElement
  const pauseBtn = root.querySelector('.pause') as HTMLButtonElement
  root.querySelector('.stop')!.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'stop' }))
  pauseBtn.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'togglePause' }))

  let visible = false
  const mount = () => {
    if (!host.isConnected) document.documentElement.appendChild(host)
  }
  return {
    update(s: RecorderState) {
      visible = s.recording
      if (!s.recording) {
        host.remove()
        return
      }
      mount()
      host.style.visibility = 'visible'
      barEl.classList.toggle('paused', s.paused)
      label.textContent = s.paused ? `Paused · ${s.count} steps` : `Capturing · ${s.count} step${s.count === 1 ? '' : 's'}`
      pauseBtn.textContent = s.paused ? 'Resume' : 'Pause'
    },
    hide() {
      host.style.visibility = 'hidden'
    },
    show() {
      if (visible) host.style.visibility = 'visible'
    },
    contains(e: Event) {
      return e.composedPath().includes(host)
    },
  }
}
