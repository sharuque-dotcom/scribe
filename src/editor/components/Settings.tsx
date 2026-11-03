import { useEffect, useState } from 'react'
import { loadSettings, MODEL, saveSettings, type AiSettings } from '../../shared/ai'
import { AI_ENABLED } from '../../shared/features'
import { LicenseSection } from './License'
import { Modal } from '../ui'
import { HIGHLIGHT_PRESETS } from '../../shared/render'
import { loadHighlight, saveHighlight } from '../../shared/prefs'
import { usePlan } from '../usePlan'
import { FEATURES } from '../../shared/plans'
import { openCheckout } from '../upgrade'

export function SettingsDialog({ onClose }: { onClose: (saved?: AiSettings) => void }) {
  const [s, setS] = useState<AiSettings>(loadSettings)
  return (
    <Modal title="Settings" onClose={() => onClose()}>
      <div className="space-y-4 text-sm">
        <LicenseSection />
        <HighlightSection />
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
              openCheckout()
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
