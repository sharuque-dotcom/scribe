// Extension service worker: owns recording state, takes screenshots,
// and writes steps into IndexedDB as they arrive.
import { describeEvent, shouldMerge } from '../shared/describe'
import { recheckLicense } from '../shared/license'
import { pixelateRects } from '../shared/redact'
import { pickedSource } from '../shared/coords'
import { deleteChunks, deleteGuide, deleteImage, getGuide, putGuide, putImage } from '../shared/db'
import type { Annotation, CaptureMode, CapturedEvent, CursorSample, Guide, NRect, RecordSource, RecorderState, RedactSample, Step, VideoRecording } from '../shared/types'
import { DEFAULT_VIDEO_SETTINGS, uid } from '../shared/types'

const IDLE: RecorderState = { recording: false, paused: false, count: 0 }

async function getState(): Promise<RecorderState> {
  const { recorder } = await chrome.storage.session.get('recorder')
  return (recorder as RecorderState) ?? IDLE
}

async function setState(s: RecorderState) {
  await chrome.storage.session.set({ recorder: s })
  await chrome.action.setBadgeBackgroundColor({ color: s.paused ? '#f59e0b' : '#ef4444' })
  await chrome.action.setBadgeText({ text: s.notice ? '!' : s.recording ? (s.paused ? 'II' : String(s.count || 'REC')) : '' })
  const tabs = await chrome.tabs.query({})
  for (const t of tabs) {
    if (t.id !== undefined) chrome.tabs.sendMessage(t.id, { type: 'state', state: s }).catch(() => {})
  }
}

// ---------- screenshots ----------

// Chrome allows about two captureVisibleTab calls per second, so captures run
// one at a time through a chain.
const MIN_GAP_MS = 520
let lastCapture = 0
let captureChain: Promise<unknown> = Promise.resolve()
let capturing = 0

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Shot {
  dataUrl: string
  w: number
  h: number
  redact?: NRect[]
  // Which page (document) was showing, and its change counter, as reported by that page.
  page?: string
  seq?: number
}

// Ask the page to hide the capture bar and say which page it is. A page that
// is navigating away won't answer, so don't wait long.
async function prepare(tabId: number | undefined): Promise<{ redactRects?: NRect[]; page?: string; seq?: number } | undefined> {
  if (tabId === undefined) return undefined
  const reply = await Promise.race([
    chrome.tabs.sendMessage(tabId, { type: 'prepareCapture' }).catch(() => undefined),
    sleep(150).then(() => undefined),
  ])
  return reply as { redactRects?: NRect[]; page?: string; seq?: number } | undefined
}

async function screenshot(windowId: number, tabId?: number, fallbackRedact: NRect[] = []): Promise<Shot> {
  for (let attempt = 0; ; attempt++) {
    const wait = lastCapture + MIN_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    const reply = await prepare(tabId)
    const redact = reply?.redactRects
    lastCapture = Date.now()
    try {
      const raw = await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 88 })
      const bmp = await createImageBitmap(await (await fetch(raw)).blob())
      const size = { w: bmp.width, h: bmp.height }
      const secrets = redact ?? fallbackRedact
      // Secret fields are pixelated in the saved image itself, so the readable
      // value never reaches storage.
      let dataUrl = raw
      if (secrets.length) {
        const canvas = new OffscreenCanvas(size.w, size.h)
        canvas.getContext('2d')!.drawImage(bmp, 0, 0)
        pixelateRects(canvas, secrets)
        dataUrl = await blobToDataUrl(await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.88 }))
      }
      bmp.close()
      return { dataUrl, ...size, redact, page: reply?.page, seq: reply?.seq }
    } catch (err) {
      if (attempt >= 3) throw err
    }
  }
}

// Recent screenshots of each recent page, labelled with the page's change
// counter, so a step can use the one that shows the page as it was when the
// user acted.
const pageShots = new Map<string, Shot[]>()
function remember(shot: Shot) {
  if (!shot.page) return
  const list = pageShots.get(shot.page) ?? []
  pageShots.delete(shot.page)
  pageShots.set(shot.page, [...list, shot].slice(-5))
  while (pageShots.size > 4) pageShots.delete(pageShots.keys().next().value!)
}
// The screenshot of `page` showing exactly state `seq`, or else the newest one
// taken before it.
function storedShot(page: string, seq: number, exact: boolean): Shot | undefined {
  const list = pageShots.get(page) ?? []
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i]
    if (s.seq === undefined) continue
    if (exact ? s.seq === seq : s.seq <= seq) return s
  }
  return undefined
}

function capture(windowId: number, tabId?: number, fallbackRedact: NRect[] = []): Promise<Shot> {
  capturing++
  const shot = captureChain.then(() => screenshot(windowId, tabId, fallbackRedact))
  captureChain = shot.catch(() => {})
  return shot.then(
    (s) => {
      capturing--
      remember(s)
      return s
    },
    (err) => {
      capturing--
      throw err
    },
  )
}

// The screenshot for a step: the page exactly as it was at the action.
async function shotForEvent(windowId: number, tabId: number | undefined, event: CapturedEvent): Promise<Shot> {
  const { page, seq } = event
  if (!page || seq === undefined) return capture(windowId, tabId, event.redactRects)
  // 1. Already captured (a quiet-moment screenshot, or the same moment as another step).
  let hit = storedShot(page, seq, true)
  if (hit) return hit
  // A capture already under way may be exactly this moment; wait for it, then look again.
  await captureChain
  hit = storedShot(page, seq, true)
  if (hit) return hit
  // 2. Take one now.
  const shot = await capture(windowId, tabId, event.redactRects)
  if (shot.page === page && shot.seq === seq) return shot
  // 3. The page already changed (the click took effect, or another page opened):
  // use the newest screenshot from before the action, so a step never shows its own result.
  if (shot.page !== page || (shot.seq !== undefined && shot.seq > seq)) return storedShot(page, seq, false) ?? shot
  return shot
}

// A spare screenshot when the page has been quiet for a moment, so the state the
// user acts on next is usually already captured. Skipped if it's already stored
// or would delay a step's screenshot.
const preshotTimers = new Map<number, ReturnType<typeof setTimeout>>()
function preshot(windowId: number, tabId: number, page?: string, seq?: number) {
  clearTimeout(preshotTimers.get(tabId))
  preshotTimers.delete(tabId)
  if (page && seq !== undefined && storedShot(page, seq, true)) return
  // Chrome's limit is busy: try again as soon as it frees up.
  const wait = capturing > 0 ? MIN_GAP_MS : lastCapture + MIN_GAP_MS - Date.now()
  if (wait > 0) {
    preshotTimers.set(tabId, setTimeout(() => preshot(windowId, tabId, page, seq), wait + 20))
    return
  }
  capture(windowId, tabId).catch(() => {})
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${blob.type};base64,${btoa(bin)}`
}

// Steps are processed one at a time, in the order they arrive.
let queue: Promise<unknown> = Promise.resolve()
const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = queue.then(fn, fn)
  queue = next.catch(() => {})
  return next
}

async function addStep(event: CapturedEvent, windowId: number, tabId?: number, pendingShot?: Promise<Shot> | null) {
  const state = await getState()
  if (!state.recording || state.paused || !state.guideId) return
  const guide = await getGuide(state.guideId)
  if (!guide) return

  // Video-only captures still record each step (it becomes a caption and a zoom)
  // but skip the screenshot.
  const shots = guide.mode !== 'video'
  const shot = shots ? await (pendingShot ?? shotForEvent(windowId, tabId, event)) : null
  const redact = shot?.redact
  const imageId = shot ? uid() : undefined
  if (shot && imageId) await putImage({ id: imageId, dataUrl: shot.dataUrl, w: shot.w, h: shot.h })

  const now = Date.now()
  const blurs: Annotation[] = (shots ? redact ?? event.redactRects : []).map((r) => ({
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
    vClick: event.vClick,
    vRect: event.vRect,
    vLabel: event.vLabel,
    showAutoHighlight: event.action !== 'key' && event.action !== 'navigate',
    annotations: blurs,
    elementKey: event.elementKey,
    createdAt: now,
  }

  const last = guide.steps[guide.steps.length - 1]
  if (shouldMerge(last, event, now)) {
    if (last.imageId) await deleteImage(last.imageId)
    step.click = last.click ?? step.click
    step.vClick = last.vClick ?? step.vClick
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
    reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.DISPLAY_MEDIA],
    justification: 'Record the tab, window or screen the user picked while capturing a guide',
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

// ---------- recording through Chrome's share dialog ----------
// The offscreen document (a hidden StepCrumb page) asks Chrome's share dialog
// what to record (a tab, a window or the entire screen) and records it. Nothing
// visible has to stay open, so the page keeps its full width and nothing of
// StepCrumb's ends up in the video. Each piece is also saved as it's recorded.

type Started = { id: string; startedAt: number; w: number; h: number; viaDialog?: boolean; source: RecordSource }

// Plain-language reasons for errors Chrome gives when screen capture can't start.
function captureError(message: string): string {
  if (/timeout starting video source|could not start video source|NotReadableError/i.test(message)) {
    return "Chrome couldn't start recording your screen. On a Mac: quit Chrome completely (Cmd+Q) and open it again, and check that Google Chrome is on in System Settings → Privacy & Security → Screen Recording. Or pick a Chrome tab instead."
  }
  return `Recording couldn't start: ${message}`
}

async function startDialogVideo(): Promise<{ video: Started | null; notice?: string }> {
  const id = uid()
  try {
    await ensureOffscreen()
    const res = await toOffscreen<{ startedAt: number; w: number; h: number; surface?: string; label?: string; cancelled?: boolean }>({ type: 'rec-start-display', videoId: id })
    if (res?.cancelled) return { video: null }
    if (res?.error || !res?.startedAt) return { video: null, notice: captureError(res?.error ?? 'unknown error') }
    return { video: { id, startedAt: res.startedAt, w: res.w, h: res.h, viaDialog: true, source: pickedSource(res.surface, res.label ?? '') } }
  } catch (err) {
    return { video: null, notice: captureError(String((err as Error)?.message ?? err)) }
  }
}

async function stopVideo(rec: VideoRecording, videoId: string | null, redact: RedactSample[] = []): Promise<number> {
  if (rec.viaDialog) {
    try {
      const res = await toOffscreen<{ duration: number }>({ type: 'rec-stop', videoId, redact })
      if (res?.duration) return res.duration
    } catch {
      // The offscreen document went away; rebuild from the saved pieces below.
    }
    if (!videoId) {
      await deleteChunks(rec.id).catch(() => {})
      return 0
    }
    try {
      await ensureOffscreen()
      const res = await toOffscreen<{ duration: number }>({ type: 'rec-recover', videoId, redact })
      return res?.duration ?? 0
    } catch {
      return 0
    }
  }
  try {
    const res = await toOffscreen<{ duration: number }>({ type: 'rec-stop', videoId, redact })
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

async function start(title?: string, opts: { mode?: CaptureMode; video?: boolean; source?: 'tab' | 'pick' } = {}): Promise<RecorderState> {
  const mode: CaptureMode = opts.mode ?? (opts.video ? 'both' : 'screenshots')
  const current = await getState()
  if (current.recording) return current
  // The page they're working on: the active tab of their last-used browser window.
  const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null)
  const [tab] = await chrome.tabs.query(win?.id !== undefined ? { active: true, windowId: win.id } : { active: true, lastFocusedWindow: true })
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
    mode,
  }
  const web = tab?.id !== undefined && !!tab.url && /^https?:/.test(tab.url)
  const wantVideo = mode !== 'screenshots'
  let video: Started | null = null
  // 'pick' (the default): Chrome's share dialog asks what to record.
  // 'tab': record the current tab directly (the keyboard shortcut).
  if (wantVideo && (opts.source ?? 'pick') === 'pick') {
    const res = await startDialogVideo()
    // Cancelled, or Chrome couldn't start capturing: nothing is recorded.
    if (!res.video) {
      await setState({ ...IDLE, notice: res.notice })
      // The popup has usually closed by now; the badge says there's a message.
      if (res.notice) await chrome.action.setBadgeText({ text: '!' }).catch(() => {})
      return getState()
    }
    video = res.video
  } else if (wantVideo && web) {
    const v = await startVideo(tab.id!)
    video = v && { ...v, source: 'tab' }
  }
  // Nothing to make without the video.
  if (mode === 'video' && !video) return getState()
  if (video) {
    // Recordings made through Chrome's share dialog (the recorder tab)
    // include the real pointer; direct tab capture doesn't.
    guide.video = { blobId: video.id, source: video.source, cursorInVideo: !!video.viaDialog, duration: 0, w: video.w, h: video.h, cursor: [], redact: [], trimStart: 0, settings: { ...DEFAULT_VIDEO_SETTINGS } }
    cursorBuf = []
    redactBuf = []
  }
  await putGuide(guide)
  const state: RecorderState = {
    recording: true,
    paused: false,
    guideId: guide.id,
    count: 0,
    mode,
    video: !!video,
    rec: video ? { id: video.id, source: video.source, viaDialog: video.viaDialog, startedAt: video.startedAt, pausedMs: 0 } : undefined,
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

// Set while a recording is being finished, so closing the recorder tab as part
// of finishing doesn't start a second stop.
let stopping = false

async function stop(openEditor = true, reason?: string): Promise<RecorderState> {
  if (stopping) return getState()
  stopping = true
  try {
    return await finish(openEditor, reason)
  } finally {
    stopping = false
  }
}

async function finish(openEditor: boolean, reason?: string): Promise<RecorderState> {
  await queue
  const state = await getState()
  if (state.guideId) {
    if (state.rec) await flushTracks(true)
    const saved = await getGuide(state.guideId)
    const duration = state.rec ? await stopVideo(state.rec, state.rec.id, saved?.video?.redact ?? []) : 0
    const guide = await getGuide(state.guideId)
    if (guide) {
      if (guide.video) {
        if (duration > 0) {
          guide.video.duration = duration
          if (reason) guide.video.endReason = reason
        }
        // No usable video (e.g. it failed to save): keep the guide, drop the video.
        else guide.video = undefined
      }
      guide.status = 'ready'
      guide.updatedAt = Date.now()
      await putGuide(guide)
    }
    if (openEditor) {
      const videoOnly = guide?.mode === 'video' && guide.video
      await chrome.tabs.create({ url: chrome.runtime.getURL(`editor.html#/guide/${state.guideId}${videoOnly ? '/video' : ''}`) })
    }
  }
  await setState(IDLE)
  return IDLE
}

async function discard(): Promise<RecorderState> {
  await queue
  const { guideId, rec } = await getState()
  if (rec) await stopVideo(rec, null)
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
    await chrome.runtime.sendMessage({ target: 'offscreen', type: next.paused ? 'rec-pause' : 'rec-resume' }).catch(() => {})
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
        return start(msg.title, { mode: msg.mode as CaptureMode | undefined, video: !!msg.video, source: msg.source as 'tab' | 'pick' | undefined })
      case 'video-blank':
        return videoNotice("The recording looks blank. On a Mac: open System Settings → Privacy & Security → Screen Recording, turn on Google Chrome, then quit Chrome (Cmd+Q) and reopen it. Or pick a Chrome tab instead.")
      case 'video-ended':
        return videoEnded(String(msg.reason ?? 'The recording ended.'))
      case 'desktop-ping':
        return null
      case 'cursor':
        return addTracks(msg.samples as CursorSample[], msg.rects as NRect[], msg.at as number)
      case 'stop':
        return stop(msg.openEditor !== false)
      case 'togglePause':
        return togglePause()
      case 'discard':
        return discard()
      case 'capture': {
        if (sender.tab?.windowId === undefined) return null
        const event = msg.event as CapturedEvent
        // Take the screenshot now, before the click can open another page;
        // writing the step waits its turn so steps stay in order.
        const st = await getState()
        const shot = st.recording && !st.paused && st.mode !== 'video' ? shotForEvent(sender.tab.windowId, sender.tab.id, event) : null
        shot?.catch(() => {})
        return enqueue(() => addStep(event, sender.tab!.windowId, sender.tab!.id, shot))
      }
      case 'preshot': {
        const st = await getState()
        if (st.recording && !st.paused && st.mode !== 'video' && sender.tab?.active && sender.tab.id !== undefined) preshot(sender.tab.windowId, sender.tab.id, msg.page as string | undefined, msg.seq as number | undefined)
        return null
      }
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
    const { recordMode } = await chrome.storage.local.get('recordMode')
    // The shortcut records the current tab directly (no share dialog).
    await start(undefined, { mode: (recordMode as CaptureMode) ?? 'both', source: 'tab' })
  }
})

// Pages that were open before the extension loaded have no content script yet.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const s = await getState()
  if (!s.recording) return
  const tab = await chrome.tabs.get(tabId)
  if (tab.url && /^https?:/.test(tab.url)) await ensureContentScript(tabId)
})

chrome.runtime.onInstalled.addListener(() => {
  void setState(IDLE)
  scheduleLicenseCheck()
})

// ---------- license ----------
// Re-check the Pro license on browser start and once a day. A cancelled or
// lapsed key drops to Free (see src/shared/license.ts); local content is untouched.
const LICENSE_ALARM = 'license-check'
function scheduleLicenseCheck() {
  chrome.alarms.create(LICENSE_ALARM, { delayInMinutes: 1, periodInMinutes: 24 * 60 })
}
chrome.runtime.onStartup.addListener(() => {
  scheduleLicenseCheck()
  void recheckLicense(true)
})
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === LICENSE_ALARM) void recheckLicense()
})

// A message for the popup about the video being recorded now.
async function videoNotice(notice: string): Promise<RecorderState> {
  const s = await getState()
  if (!s.recording) return s
  await setState({ ...s, notice })
  await chrome.action.setBadgeText({ text: '!' }).catch(() => {})
  return getState()
}

// The video stopped before the capture did: Chrome's "Stop sharing" was pressed,
// the shared window closed, or the capture failed. Keep the video so far. Video
// only: finish. Otherwise screenshots carry on, and the popup says why.
async function videoEnded(reason: string): Promise<RecorderState> {
  await queue
  const state = await getState()
  if (!state.recording || !state.rec?.viaDialog || !state.guideId) return state
  if (state.mode === 'video') return stop(true, reason)
  await flushTracks(true)
  const saved = await getGuide(state.guideId)
  const duration = await stopVideo(state.rec, state.rec.id, saved?.video?.redact ?? [])
  const guide = await getGuide(state.guideId)
  if (guide?.video) {
    if (duration > 0) {
      guide.video.duration = duration
      guide.video.endReason = reason
    } else guide.video = undefined
    await putGuide(guide)
  }
  const next: RecorderState = { ...state, rec: undefined, video: false, notice: `${reason} The video so far is saved; screenshots are still being captured.` }
  await setState(next)
  return next
}

// Exposed for automated tests.
Object.assign(globalThis, { scribe: { start, stop, togglePause, getState, recheckLicense } })
