import { useState } from 'react'
import { activateLicense, LICENSE_CONFIG, portalUrl } from '../../shared/license'
import { FEATURES } from '../../shared/plans'
import { Icon } from '../ui'
import { openCheckout } from '../upgrade'
import { usePlan } from '../usePlan'

const maskKey = (key: string) => (key.length > 12 ? `${key.slice(0, 10)}…${key.slice(-4)}` : key)
const proFeatures = Object.values(FEATURES).filter((f) => f.tier === 'pro')

// Plan status, the license key form, and links to upgrade or manage the subscription.
export function LicenseSection({ keyOnly = false }: { keyOnly?: boolean } = {}) {
  const { license, pro, lapsed } = usePlan()
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

  const manage = (
    <a className="font-medium text-accent hover:underline" href={portalUrl()} target="_blank" rel="noreferrer">
      Manage subscription →
    </a>
  )

  if (pro && license) {
    return (
      <section className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm" aria-label="License">
        <p className="font-semibold text-green-900">StepCrumb Pro · active</p>
        {license.email && (
          <p className="mt-0.5 text-green-900">
            Licensed to <b>{license.email}</b>
          </p>
        )}
        <p className="mt-0.5 font-mono text-xs text-green-900/70">{maskKey(license.key)}</p>
        <p className="mt-2 text-xs">{manage}</p>
        <p className="mt-2 text-xs text-green-900/70">Works on {LICENSE_CONFIG.activations} computers. Moving to a new one? Remove the old one under Manage subscription.</p>
      </section>
    )
  }
  return (
    <section className="rounded-lg border border-line p-3 text-sm" aria-label="License">
      {lapsed ? (
        <div className="mb-3 rounded-md bg-amber-50 p-2.5 text-amber-900" role="status">
          <p className="font-semibold">Your Pro access has ended</p>
          <p className="text-xs">Pro is no longer active on this computer: the subscription ended, or this computer was removed from your license. StepCrumb is back on the free plan, and your guides and videos are safe here.</p>
          <p className="mt-1 text-xs">{manage}</p>
        </div>
      ) : keyOnly ? null : (
        <p className="font-semibold">Free plan</p>
      )}
      {!keyOnly && (
        <>
          <p className="mb-1 text-xs text-muted">StepCrumb Pro adds:</p>
          <ul className="mb-3 list-disc space-y-0.5 pl-5 text-xs text-muted">
            {proFeatures.map((f) => (
              <li key={f.label}>{f.label}</li>
            ))}
          </ul>
          <button className="btn-primary mb-3 w-full justify-center" onClick={openCheckout}>
            <Icon name="sparkle" /> Upgrade to Pro
          </button>
        </>
      )}
      <label className="mb-1 block text-xs font-medium" htmlFor="license-key">
        Already bought? Enter your license key
      </label>
      <div className="flex gap-2">
        <input id="license-key" className="input font-mono" placeholder="STEPCRUMB-…" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && activate()} aria-label="License key" />
        <button className="btn-secondary" onClick={activate} disabled={busy || !key.trim()}>
          {busy ? 'Checking…' : 'Activate'}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-rec" role="alert">
          {error}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">The key is in your purchase email from Polar. Only the key is checked online; your guides never leave this computer.</p>
    </section>
  )
}

// Full page at editor.html#/license (opened from the popup).
export function LicensePage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <a href="#/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        ← Library
      </a>
      <h1 className="mb-4 text-xl font-semibold">StepCrumb Pro</h1>
      <LicenseSection />
    </div>
  )
}
