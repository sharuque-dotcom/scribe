// Extension service worker: owns recording state, takes screenshots,
// and writes steps into IndexedDB as they arrive.
import { describeEvent, shouldMerge } from '../shared/describe'
import { deleteGuide, deleteImage, getGuide, putGuide, putImage } from '../shared/db'
import type { Annotation, CapturedEvent, Guide, NRect, RecorderState, Step } from '../shared/types'
import { uid } from '../shared/types'

const IDLE: RecorderState = { recording: false, paused: false, count: 0 }

async function getState(): Promise<RecorderState> {
  const { recorder } = await chrome.storage.session.get('recorder')
  return (recorder as RecorderState) ?? IDLE
}

async function setState(s: RecorderState) {
  await chrome.storage.session.set({ recorder: s })
  await chrome.action.setBadgeBackgroundColor({ color: s.paused ? '#f59e0b' : '#ef4444' })
  await chrome.action.setBadgeText({ text: s.recording ? (s.paused ? 'II' : String(s.count || 'REC')) : '' })
  const tabs = await chrome.tabs.query({})
  for (const t of tabs) {
    if (t.id !== undefined) chrome.tabs.sendMessage(t.id, { type: 'state', state: s }).catch(() => {})
  }
}

// ---------- screenshots ----------

// Chrome allows about two captureVisibleTab calls per second.
const MIN_GAP_MS = 520
let lastCapture = 0

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Ask the page to hide the capture bar. A page that is navigating away won't
// answer, so don't wait long.
async function hideBar(tabId: number | undefined): Promise<NRect[] | undefined> {
  if (tabId === undefined) return undefined
  const reply = await Promise.race([
    chrome.tabs.sendMessage(tabId, { type: 'prepareCapture' }).catch(() => undefined),
    sleep(150).then(() => undefined),
  ])
  return (reply as { redactRects?: NRect[] } | undefined)?.redactRects
}

async function screenshot(
  windowId: number,
  tabId?: number,
): Promise<{ dataUrl: string; w: number; h: number; redact?: NRect[] }> {
  for (let attempt = 0; ; attempt++) {
    const wait = lastCapture + MIN_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    const redact = await hideBar(tabId)
    lastCapture = Date.now()
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 88 })
      const blob = await (await fetch(dataUrl)).blob()
      const bmp = await createImageBitmap(blob)
      const size = { w: bmp.width, h: bmp.height }
      bmp.close()
      return { dataUrl, ...size, redact }
    } catch (err) {
      if (attempt >= 3) throw err
    }
  }
}

// Steps are processed one at a time, in the order they arrive.
let queue: Promise<unknown> = Promise.resolve()
const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = queue.then(fn, fn)
  queue = next.catch(() => {})
  return next
}

async function addStep(event: CapturedEvent, windowId: number, tabId?: number) {
  const state = await getState()
  if (!state.recording || state.paused || !state.guideId) return
  const guide = await getGuide(state.guideId)
  if (!guide) return

  const { redact, ...shot } = await screenshot(windowId, tabId)
  const imageId = uid()
  await putImage({ id: imageId, ...shot })

  const now = Date.now()
  const blurs: Annotation[] = (redact ?? event.redactRects).map((r) => ({
    id: uid(),
    type: 'blur',
    x1: r.x,
    y1: r.y,
    x2: r.x + r.w,
    y2: r.y + r.h,
    color: '#000000',
  }))
  const step: Step = {
    id: uid(),
    kind: 'step',
    title: describeEvent(event),
    action: event.action,
    target: event.target,
    url: event.url,
    pageTitle: event.pageTitle,
    imageId,
    click: event.click,
    targetRect: event.targetRect,
    labelRect: event.labelRect,
    showAutoHighlight: event.action !== 'key' && event.action !== 'navigate',
    annotations: blurs,
    elementKey: event.elementKey,
    createdAt: now,
  }

  const last = guide.steps[guide.steps.length - 1]
  if (shouldMerge(last, event, now)) {
    if (last.imageId) await deleteImage(last.imageId)
    step.click = last.click ?? step.click
    guide.steps[guide.steps.length - 1] = step
  } else {
    guide.steps.push(step)
  }
  guide.updatedAt = now
  await putGuide(guide)
  await setState({ ...state, count: guide.steps.length })
}

// ---------- start / stop ----------

async function ensureContentScript(tabId: number) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
  } catch {
    // chrome:// pages, the Web Store, etc. can't be scripted.
  }
}

async function start(title?: string): Promise<RecorderState> {
  const current = await getState()
  if (current.recording) return current
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  const now = Date.now()
  const guide: Guide = {
    id: uid(),
    title: title?.trim() || (tab?.title ? `How to use ${tab.title}` : 'Untitled guide'),
    description: '',
    createdAt: now,
    updatedAt: now,
    status: 'recording',
    steps: [],
    docs: {},
  }
  await putGuide(guide)
  const state: RecorderState = { recording: true, paused: false, guideId: guide.id, count: 0 }
  await setState(state)

  if (tab?.id !== undefined && tab.url && /^https?:/.test(tab.url)) {
    await ensureContentScript(tab.id)
    await enqueue(() =>
      addStep(
        {
          action: 'navigate',
          target: { tag: 'page', label: tab.title ?? '' },
          redactRects: [],
          url: tab.url!,
          pageTitle: tab.title ?? '',
        },
        tab.windowId,
        tab.id,
      ),
    )
  }
  return getState()
}

async function stop(openEditor = true): Promise<RecorderState> {
  await queue
  const state = await getState()
  if (state.guideId) {
    const guide = await getGuide(state.guideId)
    if (guide) {
      guide.status = 'ready'
      guide.updatedAt = Date.now()
      await putGuide(guide)
    }
    if (openEditor) {
      await chrome.tabs.create({ url: chrome.runtime.getURL(`editor.html#/guide/${state.guideId}`) })
    }
  }
  await setState(IDLE)
  return IDLE
}

async function discard(): Promise<RecorderState> {
  await queue
  const { guideId } = await getState()
  await setState(IDLE)
  if (guideId) await deleteGuide(guideId)
  return IDLE
}

async function togglePause(): Promise<RecorderState> {
  const s = await getState()
  if (!s.recording) return s
  const next = { ...s, paused: !s.paused }
  await setState(next)
  return next
}

// ---------- messaging ----------

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const handle = async (): Promise<unknown> => {
    switch (msg?.type) {
      case 'hello':
      case 'getState':
        return getState()
      case 'start':
        return start(msg.title)
      case 'stop':
        return stop(msg.openEditor !== false)
      case 'togglePause':
        return togglePause()
      case 'discard':
        return discard()
      case 'capture':
        if (sender.tab?.windowId === undefined) return null
        return enqueue(() => addStep(msg.event as CapturedEvent, sender.tab!.windowId, sender.tab!.id))
      default:
        return null
    }
  }
  handle().then(reply, (err) => reply({ error: String(err) }))
  return true
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-recording') return
  const s = await getState()
  if (s.recording) await stop()
  else await start()
})

// Pages that were open before the extension loaded have no content script yet.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const s = await getState()
  if (!s.recording) return
  const tab = await chrome.tabs.get(tabId)
  if (tab.url && /^https?:/.test(tab.url)) await ensureContentScript(tabId)
})

chrome.runtime.onInstalled.addListener(() => setState(IDLE))

// Exposed for automated tests.
Object.assign(globalThis, { scribe: { start, stop, togglePause, getState } })
