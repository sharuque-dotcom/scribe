import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { listGuides } from '../shared/db'
import type { CaptureMode, Guide, RecorderState } from '../shared/types'
import { Icon, timeAgo } from '../editor/ui'
import { usePlan } from '../editor/usePlan'
import { activateLicense, LICENSE_CONFIG } from '../shared/license'
import { cancelPanelRecording, liveStream, looksBlank, onLiveStream, startPanelRecording } from './panel-recorder'

// Tell the background this panel is open, so it can finish a recording if the
// panel closes mid-way.
chrome.runtime.connect({ name: 'panel' })
const isMac = /Mac/i.test(navigator.platform || navigator.userAgent)

const send = <T,>(msg: object) => chrome.runtime.sendMessage(msg) as Promise<T>
const MODES: { id: CaptureMode; label: string; hint: string }[] = [
  { id: 'screenshots', label: 'Screenshots', hint: 'A step-by-step guide with a screenshot for every click.' },
  { id: 'both', label: 'Screenshots + video', hint: 'The guide, plus a video of the same run.' },
  { id: 'video', label: 'Video only', hint: 'A video with auto-zoom and captions. No screenshots.' },
]

// What's being recorded, live, with a warning if a window or screen comes out blank.
function LivePreview() {
  const [stream, setStream] = useState<MediaStream | null>(liveStream())
  const [blank, setBlank] = useState(false)
  useEffect(() => onLiveStream(setStream), [])
  useEffect(() => {
    setBlank(false)
    if (!stream) return
    let gone = false
    void looksBlank(stream).then((b) => !gone && setBlank(b))
    return () => {
      gone = true
    }
  }, [stream])
  if (!stream) return null
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Recording now</p>
      <video
        className="w-full rounded-lg border border-line bg-black"
        muted
        autoPlay
        playsInline
        aria-label="Live preview of what's being recorded"
        ref={(el) => {
          if (el && el.srcObject !== stream) el.srcObject = stream
        }}
      />
      {blank && (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900" role="alert">
          <p className="font-semibold">The recording looks blank.</p>
          {isMac ? (
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>Open System Settings → Privacy &amp; Security → Screen Recording.</li>
              <li>Turn on Google Chrome.</li>
              <li>Quit Chrome completely and open it again, then record again.</li>
            </ol>
          ) : (
            <p className="mt-1">Check that the window you picked is open and not minimised, or pick Entire screen.</p>
          )}
        </div>
      )}
    </div>
  )
}

const openEditor = (hash = '') => chrome.tabs.create({ url: chrome.runtime.getURL(`editor.html${hash}`) })

// Upgrade and license key entry, right in the popup.
function LicenseBox({ pro, lapsed, onActivated }: { pro: boolean; lapsed: boolean; onActivated: () => void }) {
  const [entering, setEntering] = useState(false)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activate = async () => {
    setBusy(true)
    setError(null)
    try {
      await activateLicense(key)
      onActivated()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (pro) {
    return (
      <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900" role="status">
        <p className="font-semibold">StepCrumb Pro · active</p>
        <p className="text-xs">Every Pro feature is unlocked on this computer.</p>
      </div>
    )
  }
  return (
    <div className="mt-4 rounded-lg border border-line p-3">
      <p className="mb-2 text-xs text-muted">{lapsed ? 'Your Pro access has ended. Your guides are safe.' : 'Pro: Word, HTML & Markdown, no branding, 1080p video, all voices.'}</p>
      <button className="btn-primary w-full" onClick={() => void chrome.tabs.create({ url: LICENSE_CONFIG.checkoutUrl })}>
        Upgrade to Pro
      </button>
      {entering ? (
        <div className="mt-3">
          <div className="flex gap-2">
            <input
              autoFocus
              className="input font-mono text-xs"
              placeholder="STEPCRUMB-…"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && key.trim() && void activate()}
              aria-label="License key"
            />
            <button className="btn-secondary" onClick={() => void activate()} disabled={busy || !key.trim()}>
              {busy ? 'Checking…' : 'Activate'}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-xs text-rec" role="alert">
              {error}
            </p>
          )}
          <button className="mt-2 text-xs text-muted hover:text-ink" onClick={() => openEditor('#/license')}>
            More license options →
          </button>
        </div>
      ) : (
        <button className="mt-2 w-full text-center text-xs font-medium text-muted hover:text-ink" onClick={() => setEntering(true)}>
          Enter license key
        </button>
      )}
    </div>
  )
}

function Popup() {
  const [state, setState] = useState<RecorderState | null>(null)
  const [title, setTitle] = useState('')
  const [recent, setRecent] = useState<Guide[]>([])
  const [busy, setBusy] = useState(false)
  const [canCapture, setCanCapture] = useState(true)
  const [mode, setMode] = useState<CaptureMode>('screenshots')
  const { plan, pro, ready, lapsed } = usePlan()
  const [justActivated, setJustActivated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listGuides().then((g) => setRecent(g.slice(0, 4)))
  }, [state?.recording])

  useEffect(() => {
    send<RecorderState>({ type: 'getState' }).then(setState)
    chrome.storage.local.get('recordMode').then(({ recordMode }) => {
      if (recordMode === 'screenshots' || recordMode === 'both' || recordMode === 'video') setMode(recordMode)
    })
    // The panel stays open while they move between tabs, so keep this current.
    const checkTab = () => chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => setCanCapture(!!t?.url && /^https?:/.test(t.url)))
    void checkTab()
    const onTab = () => void checkTab()
    chrome.tabs.onActivated.addListener(onTab)
    chrome.tabs.onUpdated.addListener(onTab)
    const on = (msg: { type?: string; state?: RecorderState }) => msg?.type === 'state' && msg.state && setState(msg.state)
    chrome.runtime.onMessage.addListener(on)
    // The state also changes from the shortcut and the background; refresh it.
    const poll = setInterval(() => void send<RecorderState>({ type: 'getState' }).then(setState).catch(() => {}), 1500)
    return () => {
      chrome.runtime.onMessage.removeListener(on)
      chrome.tabs.onActivated.removeListener(onTab)
      chrome.tabs.onUpdated.removeListener(onTab)
      clearInterval(poll)
    }
  }, [])

  if (!state) return <div className="p-5 text-sm text-muted">Loading…</div>

  const video = mode !== 'screenshots'
  // Video can record a window or the screen from any page; screenshots need a web page.
  const canStart = canCapture || video
  const startMsg = { type: 'start', title, mode }

  const act = async (msg: object) => {
    setBusy(true)
    try {
      setState(await send<RecorderState>(msg))
    } finally {
      setBusy(false)
    }
  }

  // Video: Chrome's share dialog opens over their browser, and the recording runs
  // here in the panel. Screenshots only: the background captures each click.
  const begin = async () => {
    if (!video) return act(startMsg)
    setBusy(true)
    setError(null)
    try {
      const panelVideo = await startPanelRecording()
      if (!panelVideo) return
      const next = await send<RecorderState>({ ...startMsg, panelVideo })
      if (!next?.recording) await cancelPanelRecording()
      setState(next)
    } catch (err) {
      setError(`Recording couldn't start: ${(err as Error)?.message ?? err}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <img src="./icons/icon32.png" alt="" className="h-6 w-6" />
        <span className="font-semibold">StepCrumb</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${plan === 'Free' ? 'bg-amber-50 text-amber-800' : 'bg-green-100 text-green-800'}`}>{plan}</span>
        <button className="icon-btn ml-auto" onClick={() => openEditor()} title="Open library" aria-label="Open library">
          <Icon name="list" />
        </button>
      </div>

      {state.recording ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg bg-raised p-3">
            <span className={`h-3 w-3 rounded-full ${state.paused ? 'bg-amber-500' : 'animate-pulse bg-rec'}`} />
            <div className="text-sm">
              <p className="font-semibold">
                {state.paused ? 'Paused' : state.video ? 'Recording' : 'Capturing'}
                {state.video && mode !== 'video' && <span className="ml-1.5 rounded bg-rec/10 px-1.5 py-0.5 text-[11px] font-semibold text-rec">+ video</span>}
              </p>
              <p className="text-muted">
                {state.count} step{state.count === 1 ? '' : 's'} so far
              </p>
            </div>
          </div>
          {state.notice && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900" role="status">
              {state.notice}
            </p>
          )}
          <LivePreview />
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" disabled={busy} onClick={() => act({ type: 'togglePause' })}>
              {state.paused ? 'Resume' : 'Pause'}
            </button>
            <button className="btn-danger flex-1" disabled={busy} onClick={() => act({ type: 'stop' })}>
              Finish
            </button>
          </div>
          <button
            className="w-full text-center text-xs text-muted hover:text-rec"
            disabled={busy}
            onClick={() => confirm('Discard this capture? Its steps will be deleted.') && act({ type: 'discard' })}
          >
            Discard capture
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <input className="input" placeholder="What are you documenting? (optional)" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && canStart && !busy && void begin()} />
          <div className="space-y-1.5" role="radiogroup" aria-label="What to make">
            {MODES.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={mode === m.id}
                onClick={() => {
                  setMode(m.id)
                  void chrome.storage.local.set({ recordMode: m.id })
                }}
                className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left text-sm ${mode === m.id ? 'border-accent bg-accent/5' : 'border-line hover:bg-raised'}`}
              >
                <span className={`mt-0.5 grid h-4 w-4 flex-none place-items-center rounded-full border ${mode === m.id ? 'border-accent' : 'border-line'}`}>{mode === m.id && <span className="h-2 w-2 rounded-full bg-accent" />}</span>
                <span>
                  <span className="block font-medium">{m.label}</span>
                  <span className="block text-xs text-muted">{m.hint}</span>
                </span>
              </button>
            ))}
          </div>
          <button className="btn-danger w-full py-2.5" disabled={busy || !canStart} onClick={() => void begin()}>
            <Icon name="record" /> {video ? 'Start recording' : 'Start capturing'}
          </button>
          {error && (
            <p className="text-xs text-rec" role="alert">
              {error}
            </p>
          )}
          <p className="text-xs text-muted">
            {!canStart
              ? 'Open a website (http or https) to capture screenshots. Browser pages like chrome:// can’t be captured.'
              : video
                ? `Chrome will ask what to share: a tab, a window or your entire screen. Then click through your task, and finish here or press Alt+Shift+R. Keep this panel open while recording.${isMac ? ' In Mac full screen, Window only lists windows on this screen; use Chrome Tab or Entire screen instead.' : ''}`
                : 'Click through your task as usual. Each click becomes a step with a screenshot. Shortcut: Alt+Shift+R.'}
          </p>
        </div>
      )}

      {!state.recording && ready && (!pro || justActivated) && <LicenseBox pro={pro} lapsed={lapsed} onActivated={() => setJustActivated(true)} />}

      {recent.length > 0 && (
        <div className="mt-5 border-t border-line pt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Recent</p>
          {recent.map((g) => (
            <button key={g.id} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-raised" onClick={() => openEditor(`#/guide/${g.id}`)}>
              <span className="truncate">{g.title}</span>
              <span className="flex-none text-xs text-muted">{timeAgo(g.updatedAt)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
)
