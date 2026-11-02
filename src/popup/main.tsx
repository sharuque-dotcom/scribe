import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { listGuides } from '../shared/db'
import type { Guide, RecordSource, RecorderState } from '../shared/types'
import { Icon, timeAgo } from '../editor/ui'
import { usePlan } from '../editor/usePlan'

const send = <T,>(msg: object) => chrome.runtime.sendMessage(msg) as Promise<T>
const openEditor = (hash = '') => chrome.tabs.create({ url: chrome.runtime.getURL(`editor.html${hash}`) })

function Popup() {
  const [state, setState] = useState<RecorderState | null>(null)
  const [title, setTitle] = useState('')
  const [recent, setRecent] = useState<Guide[]>([])
  const [busy, setBusy] = useState(false)
  const [canCapture, setCanCapture] = useState(true)
  const [video, setVideo] = useState(true)
  const [source, setSource] = useState<RecordSource>('tab')
  const { plan } = usePlan()

  useEffect(() => {
    send<RecorderState>({ type: 'getState' }).then(setState)
    listGuides().then((g) => setRecent(g.slice(0, 4)))
    chrome.storage.local.get(['recordVideo', 'recordSource']).then(({ recordVideo, recordSource }) => {
      setVideo(recordVideo !== false)
      if (recordSource === 'window' || recordSource === 'screen') setSource(recordSource)
    })
    chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => setCanCapture(!!t?.url && /^https?:/.test(t.url)))
    const on = (msg: { type?: string; state?: RecorderState }) => msg?.type === 'state' && msg.state && setState(msg.state)
    chrome.runtime.onMessage.addListener(on)
    return () => chrome.runtime.onMessage.removeListener(on)
  }, [])

  if (!state) return <div className="p-5 text-sm text-muted">Loading…</div>

  // Window and screen recordings can start from any page; steps still come from web pages.
  const canStart = canCapture || (video && source !== 'tab')
  const startMsg = { type: 'start', title, video, source: video ? source : 'tab' }

  const act = async (msg: object, close = false) => {
    setBusy(true)
    try {
      setState(await send<RecorderState>(msg))
    } finally {
      setBusy(false)
    }
    if (close) window.close()
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
                {state.paused ? 'Paused' : 'Capturing'}
                {state.video && <span className="ml-1.5 rounded bg-rec/10 px-1.5 py-0.5 text-[11px] font-semibold text-rec">+ video</span>}
              </p>
              <p className="text-muted">
                {state.count} step{state.count === 1 ? '' : 's'} so far
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" disabled={busy} onClick={() => act({ type: 'togglePause' })}>
              {state.paused ? 'Resume' : 'Pause'}
            </button>
            <button className="btn-danger flex-1" disabled={busy} onClick={() => act({ type: 'stop' }, true)}>
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
          <input className="input" placeholder="What are you documenting? (optional)" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && canStart && act(startMsg, true)} />
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line p-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 accent-indigo-600"
              checked={video}
              onChange={(e) => {
                setVideo(e.target.checked)
                void chrome.storage.local.set({ recordVideo: e.target.checked })
              }}
            />
            <span>
              <span className="block font-medium">Also record video</span>
              <span className="block text-xs text-muted">No camera or microphone. Auto-zoom, captions and voiceover are added afterwards.</span>
            </span>
          </label>
          {video && (
            <div>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-raised p-1" role="radiogroup" aria-label="What to record">
                {(
                  [
                    ['tab', 'This tab'],
                    ['window', 'A window'],
                    ['screen', 'Entire screen'],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    role="radio"
                    aria-checked={source === k}
                    onClick={() => {
                      setSource(k)
                      void chrome.storage.local.set({ recordSource: k })
                    }}
                    className={`rounded-md px-2 py-1.5 text-xs font-medium ${source === k ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {source === 'tab'
                  ? 'Recommended. Best auto-zoom, smooth cursor and captions for every step.'
                  : `Records ${source === 'window' ? 'the window you choose' : 'your whole screen'}, including desktop apps. Steps, captions and zoom come from clicks in web pages; the rest is plain video.`}
              </p>
            </div>
          )}
          <button className="btn-danger w-full py-2.5" disabled={busy || !canStart} onClick={() => act(startMsg, true)}>
            <Icon name="record" /> Start capturing
          </button>
          <p className="text-xs text-muted">
            {canStart ? `Click through your task as usual. Each click becomes a step with a screenshot. ${video ? 'Finish from this popup or press Alt+Shift+R (there is no on-page bar while recording video).' : 'Shortcut: Alt+Shift+R.'}` : 'Open a website (http or https) to start capturing. Browser pages like chrome:// can’t be captured.'}
          </p>
        </div>
      )}

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
