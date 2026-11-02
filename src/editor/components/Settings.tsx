import { useState } from 'react'
import { loadSettings, MODEL, saveSettings, type AiSettings } from '../../shared/ai'
import { AI_ENABLED } from '../../shared/features'
import { LicenseSection } from './License'
import { Modal } from '../ui'

export function SettingsDialog({ onClose }: { onClose: (saved?: AiSettings) => void }) {
  const [s, setS] = useState<AiSettings>(loadSettings)
  return (
    <Modal title="Settings" onClose={() => onClose()}>
      <div className="space-y-4 text-sm">
        <LicenseSection />
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
