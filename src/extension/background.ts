// Extension service worker: owns recording state, takes screenshots,
// and writes steps into IndexedDB as they arrive.
import { describeEvent, shouldMerge } from '../shared/describe'
import { deleteGuide, deleteImage, getGuide, putGuide, putImage } from '../shared/db'
import type { Annotation, CapturedEvent, CursorSample, Guide, NRect, RecorderState, RedactSample, Step } from '../shared/types'
import { DEFAULT_VIDEO_SETTINGS, uid } from '../shared/types'

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
    time: state.rec ? videoTime(state, event.t ?? now) : undefined,
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
    // The caption starts when they clicked into the field, not when they finished typing.
    step.time = last.time ?? step.time
    guide.steps[guide.steps.length - 1] = step
  } else {
    guide.steps.push(step)
  }
  guide.updatedAt = now
  await putGuide(guide)
  await setState({ ...state, count: guide.steps.length })
}

// ---------- video ----------

// Milliseconds into the video for a moment in time, leaving out paused stretches.
function videoTime(state: RecorderState, epoch: number): number {
  if (!state.rec) return 0
  return Math.max(0, epoch - state.rec.startedAt - state.rec.pausedMs)
}

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT] })
  if (contexts.length) return
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: 'Record the tab while capturing a guide',
  })
}

const toOffscreen = <T>(msg: object) => chrome.runtime.sendMessage({ target: 'offscreen', ...msg }) as Promise<T & { error?: string }>

async function startVideo(tabId: number): Promise<{ id: string; startedAt: number; w: number; h: number } | null> {
  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId })
    // Record at the page's real pixel size (sharp on high-resolution screens),
    // capped at 4K, keeping its shape.
    const [{ result: size }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio }),
    })
    const scale = Math.min(size?.dpr ?? 1, 3840 / (size?.w || 1280), 2160 / (size?.h || 800))
    const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)
    const w = even((size?.w || 1280) * scale)
    const h = even((size?.h || 800) * scale)
    await ensureOffscreen()
    const res = await toOffscreen<{ startedAt: number; w: number; h: number }>({ type: 'rec-start', streamId, w, h })
    if (res?.error) throw new Error(res.error)
    return { id: uid(), startedAt: res.startedAt, w: res.w, h: res.h }
  } catch (err) {
    console.warn('Video recording could not start; capturing steps only.', err)
    return null
  }
}

async function stopVideo(videoId: string | null): Promise<number> {
  try {
    const res = await toOffscreen<{ duration: number }>({ type: 'rec-stop', videoId })
    return res?.duration ?? 0
  } catch {
    return 0
  } finally {
    await chrome.offscreen.closeDocument().catch(() => {})
  }
}

// Mouse positions and secret-field positions arrive in batches from the page.
// They're kept in memory and written to the guide every few seconds and at the end.
let cursorBuf: CursorSample[] = []
let redactBuf: RedactSample[] = []
let lastFlush = 0

async function flushTracks(force = false) {
  if (!force && Date.now() - lastFlush < 5000) return
  lastFlush = Date.now()
  if (!cursorBuf.length && !redactBuf.length) return
  const state = await getState()
  const guide = state.guideId ? await getGuide(state.guideId) : undefined
  if (!guide?.video) return
  guide.video.cursor.push(...cursorBuf)
  guide.video.redact.push(...redactBuf)
  cursorBuf = []
  redactBuf = []
  await putGuide(guide)
}

async function addTracks(samples: CursorSample[], rects: NRect[], at: number) {
  const state = await getState()
  if (!state.recording || state.paused || !state.rec) return
  for (const s of samples) cursorBuf.push({ t: videoTime(state, s.t), x: s.x, y: s.y })
  const prev = redactBuf[redactBuf.length - 1]
  // Only store a new entry when the secret fields moved or changed.
  if (!prev || JSON.stringify(prev.rects) !== JSON.stringify(rects)) redactBuf.push({ t: videoTime(state, at), rects })
  await flushTracks()
}

// ---------- start / stop ----------

async function ensureContentScript(tabId: number) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
  } catch {
    // chrome:// pages, the Web Store, etc. can't be scripted.
  }
}

async function start(title?: string, opts: { video?: boolean } = {}): Promise<RecorderState> {
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
  const web = tab?.id !== undefined && !!tab.url && /^https?:/.test(tab.url)
  const video = opts.video && web ? await startVideo(tab.id!) : null
  if (video) {
    guide.video = { blobId: video.id, duration: 0, w: video.w, h: video.h, cursor: [], redact: [], trimStart: 0, settings: { ...DEFAULT_VIDEO_SETTINGS } }
    cursorBuf = []
    redactBuf = []
  }
  await putGuide(guide)
  const state: RecorderState = {
    recording: true,
    paused: false,
    guideId: guide.id,
    count: 0,
    video: !!video,
    rec: video ? { id: video.id, startedAt: video.startedAt, pausedMs: 0 } : undefined,
  }
  await setState(state)

  if (web) {
    await ensureContentScript(tab!.id!)
    await enqueue(() =>
      addStep(
        {
          action: 'navigate',
          target: { tag: 'page', label: tab.title ?? '' },
          redactRects: [],
          url: tab.url!,
          pageTitle: tab.title ?? '',
          t: video?.startedAt,
        },
        tab!.windowId,
        tab!.id,
      ),
    )
  }
  return getState()
}

async function stop(openEditor = true): Promise<RecorderState> {
  await queue
  const state = await getState()
  if (state.guideId) {
    if (state.rec) await flushTracks(true)
    const duration = state.rec ? await stopVideo(state.rec.id) : 0
    const guide = await getGuide(state.guideId)
    if (guide) {
      if (guide.video) {
        if (duration > 0) guide.video.duration = duration
        // No usable video (e.g. it failed to save): keep the guide, drop the video.
        else guide.video = undefined
      }
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
  const { guideId, rec } = await getState()
  if (rec) await stopVideo(null)
  cursorBuf = []
  redactBuf = []
  await setState(IDLE)
  if (guideId) await deleteGuide(guideId)
  return IDLE
}

async function togglePause(): Promise<RecorderState> {
  const s = await getState()
  if (!s.recording) return s
  const next: RecorderState = { ...s, paused: !s.paused }
  if (s.rec) {
    const now = Date.now()
    await toOffscreen({ type: next.paused ? 'rec-pause' : 'rec-resume' }).catch(() => {})
    next.rec = next.paused
      ? { ...s.rec, pausedAt: now }
      : { ...s.rec, pausedAt: undefined, pausedMs: s.rec.pausedMs + (s.rec.pausedAt ? now - s.rec.pausedAt : 0) }
  }
  await setState(next)
  return next
}

// ---------- messaging ----------

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.target === 'offscreen') return
  const handle = async (): Promise<unknown> => {
    switch (msg?.type) {
      case 'hello':
      case 'getState':
        return getState()
      case 'start':
        return start(msg.title, { video: !!msg.video })
      case 'cursor':
        return addTracks(msg.samples as CursorSample[], msg.rects as NRect[], msg.at as number)
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
  else {
    const { recordVideo } = await chrome.storage.local.get('recordVideo')
    await start(undefined, { video: recordVideo !== false })
  }
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
