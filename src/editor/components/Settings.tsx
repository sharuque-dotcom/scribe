import { useEffect, useState } from 'react'
import { loadSettings, MODEL, saveSettings, type AiSettings } from '../../shared/ai'
import { AI_ENABLED } from '../../shared/features'
import { LicenseSection } from './License'
import { Modal } from '../ui'
import { HIGHLIGHT_PRESETS } from '../../shared/render'
import { loadHighlight, saveHighlight } from '../../shared/prefs'
import { loadAutoBlurSaved, saveAutoBlur } from '../../shared/autoblur'
import { countsOn, setCountsOn } from '../../shared/telemetry'
import { PII_LABEL, type AutoBlurSettings } from '../../shared/pii'
import { usePlan } from '../usePlan'
import { FEATURES } from '../../shared/plans'
import { openPlans } from '../actions'

// Your plan: Pro shows the license; Free offers the plans window and the key form.
function PlanSection({ onPlans }: { onPlans: () => void }) {
  const { pro, ready } = usePlan()
  if (!ready) return null
  if (pro) return <LicenseSection />
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-canvas p-3.5">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Free plan</span>
          <span className="block text-xs text-muted">Pro adds Word, HTML and Markdown, 1080p videos of any length, no StepCrumb mark, and more.</span>
        </span>
        <button
          className="btn-primary rounded-xl"
          onClick={() => {
            onPlans()
            openPlans()
          }}
        >
          See plans
        </button>
      </div>
      <LicenseSection keyOnly />
    </div>
  )
}

export function SettingsDialog({ onClose }: { onClose: (saved?: AiSettings) => void }) {
  const [s, setS] = useState<AiSettings>(loadSettings)
  return (
    <Modal title="Settings" onClose={() => onClose()}>
      <div className="space-y-4 text-sm">
        <PlanSection onPlans={() => onClose()} />
        <HighlightSection />
        <AutoBlurSection />
        <CountsSection />
        {AI_ENABLED && (
          <>
            <h3 className="border-t border-line pt-4 font-semibold">AI writing (optional)</h3>
            <p className="-mt-2 text-xs text-muted">
              Everything else in StepCrumb stays on this computer. When you click a Claude button, the step text (and screenshots, if ticked below, with secret fields already blurred) is sent to Anthropic using your key.
            </p>
            <label className="block">
              <span className="mb-1 block font-medium">Anthropic API key</span>
              <input className="input font-mono" type="password" autoComplete="off" placeholder="sk-ant-..." value={s.apiKey} onChange={(e) => setS({ ...s, apiKey: e.target.value.trim() })} />
              <span className="mt-1 block text-xs text-muted">
                Stored only in this browser and sent only to api.anthropic.com. Get one at console.anthropic.com. Uses {MODEL}.
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block font-medium">Who is it for?</span>
              <input className="input" value={s.audience} onChange={(e) => setS({ ...s, audience: e.target.value })} placeholder="e.g. new support agents" />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium">Tone</span>
              <input className="input" value={s.tone} onChange={(e) => setS({ ...s, tone: e.target.value })} placeholder="e.g. formal, concise" />
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5" checked={s.includeScreenshots} onChange={(e) => setS({ ...s, includeScreenshots: e.target.checked })} />
              <span>
                Send screenshots to Claude
                <span className="block text-xs text-muted">Gives better results. Blurred areas stay blurred. Up to 30 screenshots per request.</span>
              </span>
            </label>
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={() => onClose()}>
            {AI_ENABLED ? 'Cancel' : 'Close'}
          </button>
          {AI_ENABLED && (
            <button
              className="btn-primary"
              onClick={() => {
                saveSettings(s)
                onClose(s)
              }}
            >
              Save
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

// The colour of the automatic click highlight on every screenshot.
function HighlightSection() {
  const { can } = usePlan()
  const [color, setColor] = useState<string | null>(null)
  const [changed, setChanged] = useState(false)
  useEffect(() => {
    void loadHighlight().then(setColor)
  }, [])
  const pick = async (c: string) => {
    setColor(c)
    await saveHighlight(c)
    setChanged(true)
  }
  if (!color) return null
  const custom = !HIGHLIGHT_PRESETS.includes(color.toLowerCase())
  return (
    <div className="border-t border-line pt-4">
      <h3 className="font-semibold">Highlight colour</h3>
      <p className="mb-2 text-xs text-muted">The box or circle around what was clicked, on every screenshot.</p>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Highlight colour">
        {HIGHLIGHT_PRESETS.map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={color.toLowerCase() === c}
            aria-label={`Highlight colour ${c}`}
            onClick={() => void pick(c)}
            className={`h-8 w-8 rounded-full border-2 ${color.toLowerCase() === c ? 'border-ink ring-2 ring-offset-2 ring-ink/20' : 'border-white shadow'}`}
            style={{ background: c }}
          />
        ))}
        <label
          className={`relative flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs ${custom ? 'border-ink' : 'border-line'} ${can('customHighlight') ? 'cursor-pointer' : 'cursor-pointer opacity-80'}`}
          title={can('customHighlight') ? 'Pick any colour' : `Pro: ${FEATURES.customHighlight.label}`}
          onClick={(e) => {
            if (!can('customHighlight')) {
              e.preventDefault()
              openPlans()
            }
          }}
        >
          <span className="h-4 w-4 rounded-full border border-line" style={{ background: custom ? color : 'conic-gradient(#ef4444,#eab308,#22c55e,#3b82f6,#a855f7,#ef4444)' }} />
          Your colour{!can('customHighlight') && <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">Pro</span>}
          {can('customHighlight') && <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={color} onChange={(e) => void pick(e.target.value)} aria-label="Your own highlight colour" />}
        </label>
      </div>
      {changed && (
        <p className="mt-2 text-xs text-muted">
          Saved. <button className="font-medium text-accent hover:underline" onClick={() => location.reload()}>Reload</button> to see it on every screenshot.
        </p>
      )}
    </div>
  )
}

// Auto-blur: which personal details to blur while capturing, plus your own words.
function AutoBlurSection() {
  const { can } = usePlan()
  const [s, setS] = useState<AutoBlurSettings | null>(null)
  const [words, setWords] = useState('')
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return
    void loadAutoBlurSaved().then((v) => {
      setS(v)
      setWords(v.custom.join('\n'))
    })
  }, [])
  if (!s) return null
  const save = (next: AutoBlurSettings) => {
    setS(next)
    void saveAutoBlur(next)
  }
  const kinds = Object.keys(s.kinds) as (keyof AutoBlurSettings['kinds'])[]
  const pro = can('autoBlurWords')
  return (
    <div className="border-t border-line pt-4">
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block font-semibold">Auto-blur personal details</span>
          <span className="block text-xs text-muted">While capturing, these are blurred on screenshots and video and left out of step text. You can remove any blur in the editor.</span>
        </span>
        <input type="checkbox" className="accent-indigo-600" checked={s.on} onChange={(e) => save({ ...s, on: e.target.checked })} aria-label="Auto-blur personal details" />
      </label>
      {s.on && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-1.5 sm:grid-cols-2">
            {kinds.map((k) => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" className="accent-indigo-600" checked={s.kinds[k]} onChange={(e) => save({ ...s, kinds: { ...s.kinds, [k]: e.target.checked } })} />
                {PII_LABEL[k]}
              </label>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 flex items-center gap-2 font-medium">
              {PII_LABEL.custom}
              {!pro && <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">Pro</span>}
            </span>
            <textarea
              className="input h-20 font-mono text-xs"
              placeholder={'One per line, e.g.\nAl Mansoori\n/MRN-\\d{6}/'}
              value={words}
              disabled={!pro}
              onChange={(e) => setWords(e.target.value)}
              onBlur={() => save({ ...s, custom: words.split('\n').map((w) => w.trim()).filter(Boolean) })}
              aria-label="Your own words and patterns"
            />
            <span className="mt-1 block text-xs text-muted">
              {pro ? 'Words match in any case. Put a pattern between slashes, like /MRN-\\d{6}/ for medical record numbers.' : (
                <>
                  Blur names, record numbers or anything specific to your work.{' '}
                  <button className="font-medium text-accent hover:underline" onClick={openPlans}>
                    Upgrade to Pro
                  </button>
                </>
              )}
            </span>
          </label>
        </div>
      )}
    </div>
  )
}

// Anonymous counts: on by default, one switch to turn them off.
function CountsSection() {
  const [on, setOn] = useState<boolean | null>(null)
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return
    void countsOn().then(setOn)
  }, [])
  if (on === null) return null
  return (
    <div className="border-t border-line pt-4">
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block font-semibold">Send anonymous counts</span>
          <span className="block text-xs text-muted">Helps us see how StepCrumb is used, for example "1 guide made" or "1 PDF exported". Never what you capture, no page addresses, nothing that identifies you.</span>
        </span>
        <input
          type="checkbox"
          className="accent-indigo-600"
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked)
            void setCountsOn(e.target.checked)
          }}
          aria-label="Send anonymous counts"
        />
      </label>
    </div>
  )
}
