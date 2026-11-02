import { useState } from 'react'
import { loadSettings, MODEL, saveSettings, type AiSettings } from '../../shared/ai'
import { activateLicense, deactivateLicense, LICENSE_CONFIG } from '../../shared/license'
import { usePlan } from '../usePlan'
import { Modal } from '../ui'

function LicenseSection() {
  const { license, pro, plan } = usePlan()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activate = async () => {
    setBusy(true)
    setError(null)
    try {
      await activateLicense(key)
      setKey('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (pro && license) {
    return (
      <section className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm" aria-label="License">
        <p className="font-semibold text-green-900">StepCrumb {plan} · active</p>
        {license.email && <p className="text-xs text-green-900/70">{license.email}</p>}
        <button
          className="mt-2 text-xs font-medium text-green-900/70 hover:text-rec"
          disabled={busy}
          onClick={async () => {
            if (!confirm('Remove the license from this browser? You can use the key on another computer afterwards.')) return
            setBusy(true)
            await deactivateLicense(license)
            setBusy(false)
          }}
        >
          Remove license from this browser
        </button>
      </section>
    )
  }
  return (
    <section className="rounded-lg border border-line p-3 text-sm" aria-label="License">
      <p className="font-semibold">Free plan</p>
      <p className="mb-2 text-xs text-muted">Unlock branding-free PDFs, Word/HTML/Markdown, 1080p video without watermark or length limit, and all voices.</p>
      <div className="flex gap-2">
        <input className="input font-mono" placeholder="License key" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && activate()} aria-label="License key" />
        <button className="btn-primary" onClick={activate} disabled={busy || !key.trim()}>
          {busy ? 'Checking…' : 'Activate'}
        </button>
      </div>
      {license && !pro && <p className="mt-2 text-xs text-rec">Your license is {license.status === 'expired' ? 'expired' : 'no longer active'}. Enter a new key or renew.</p>}
      {error && <p className="mt-2 text-xs text-rec" role="alert">{error}</p>}
      <a className="mt-2 inline-block text-xs font-medium text-accent hover:underline" href={LICENSE_CONFIG.buyUrl} target="_blank" rel="noreferrer">
        Get a license →
      </a>
    </section>
  )
}

export function SettingsDialog({ onClose }: { onClose: (saved?: AiSettings) => void }) {
  const [s, setS] = useState<AiSettings>(loadSettings)
  return (
    <Modal title="Settings" onClose={() => onClose()}>
      <div className="space-y-4 text-sm">
        <LicenseSection />
        <h3 className="border-t border-line pt-4 font-semibold">AI writing (optional)</h3>
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
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={() => onClose()}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              saveSettings(s)
              onClose(s)
            }}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}
