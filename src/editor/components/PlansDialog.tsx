// "Change your plan": Free, Pro (monthly or yearly) and Lifetime side by side,
// with the license key form underneath. Every upgrade goes to the one Polar checkout.
import { useEffect, useState } from 'react'
import { PRICES } from '../../shared/license'
import { FEATURES } from '../../shared/plans'
import { Icon } from '../ui'
import { openCheckout } from '../upgrade'
import { usePlan } from '../usePlan'
import { LicenseSection } from './License'

const FREE = ['Unlimited guides, SOPs and training', 'Auto-blur of personal details', 'PDF export', 'Guide me walkthroughs', 'Narrated videos up to 5 minutes, 720p', 'Your captures stay on your computer']
const PRO = Object.values(FEATURES)
  .filter((f) => f.tier === 'pro')
  .map((f) => f.label)

function Card({ name, blurb, price, per, note, cta, onCta, current, featured, tag, intro, items }: {
  name: string
  blurb: string
  price: string
  per?: string
  note?: string
  cta: string
  onCta?: () => void
  current?: boolean
  featured?: boolean
  tag?: string
  intro: string
  items: string[]
}) {
  return (
    <div className={`relative flex flex-col overflow-hidden rounded-2xl border bg-surface ${featured ? 'border-accent/50 shadow-float ring-1 ring-accent/20' : 'border-line'}`}>
      <div className="p-6">
        <div className="flex items-center gap-2">
          <h3 className="text-[19px] font-semibold tracking-tight">{name}</h3>
          {tag && <span className="rounded-full bg-ember/10 px-2 py-0.5 text-[11px] font-semibold text-ember">{tag}</span>}
          {featured && <span className="ml-auto rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">Most popular</span>}
        </div>
        <p className="mt-1 min-h-[40px] text-sm text-muted">{blurb}</p>
        <p className="mt-5 flex items-baseline gap-1.5">
          <span className="text-[38px] font-semibold leading-none tracking-tight">{price}</span>
          {per && <span className="text-sm text-muted">{per}</span>}
        </p>
        <p className="mt-1.5 h-5 text-xs text-muted">{note}</p>
        <button
          className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition ${current ? 'cursor-default bg-raised text-muted' : featured ? 'bg-accent text-white hover:bg-accent/90' : 'border border-line bg-surface hover:bg-raised'}`}
          onClick={current ? undefined : onCta}
          disabled={current}
        >
          {cta}
        </button>
      </div>
      <div className="flex-1 border-t border-line bg-canvas/70 p-6">
        <p className="mb-3 text-sm font-medium">{intro}</p>
        <ul className="space-y-2.5 text-sm">
          {items.map((t) => (
            <li key={t} className="flex gap-2.5">
              <Icon name="check" className="mt-0.5 h-4 w-4 flex-none text-accent" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function PlansDialog({ onClose }: { onClose: () => void }) {
  const { pro, ready } = usePlan()
  const [yearly, setYearly] = useState(true)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const save = Math.round((1 - PRICES.yearly / (PRICES.monthly * 12)) * 100)
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-ink/40 p-4 backdrop-blur-[2px] sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={pro ? 'Your plan' : 'Change your plan'} className="mx-auto max-w-5xl rounded-3xl bg-surface p-6 shadow-float sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <h2 className="mr-auto text-[22px] font-semibold tracking-tight">{pro ? 'Your plan' : 'Change your plan'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {!pro && ready && (
          <>
            <div className="mb-6 inline-flex rounded-full border border-line bg-canvas p-1 text-sm" role="radiogroup" aria-label="Billing">
              {[false, true].map((y) => (
                <button key={String(y)} role="radio" aria-checked={yearly === y} onClick={() => setYearly(y)} className={`rounded-full px-4 py-1.5 font-medium transition ${yearly === y ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
                  {y ? 'Yearly' : 'Monthly'}
                  {y && <span className="ml-1.5 font-semibold text-accent">save {save}%</span>}
                </button>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Card name="Free" blurb="Everything you need to document a process." price="$0" note="No account, no card." cta="Current plan" current intro="Included:" items={FREE} />
              <Card
                name="Pro"
                blurb="Polished, on-brand output for work you share."
                price={`$${yearly ? PRICES.yearly : PRICES.monthly}`}
                per={yearly ? '/ year' : '/ month'}
                note={yearly ? `That's $${(PRICES.yearly / 12).toFixed(2)} a month, billed yearly.` : 'Cancel any time.'}
                cta="Upgrade to Pro"
                onCta={openCheckout}
                featured
                intro="Everything in Free, plus:"
                items={PRO}
              />
              <Card
                name="Lifetime"
                blurb="Pay once, keep Pro for as long as StepCrumb exists."
                price={`$${PRICES.lifetime}`}
                per="once"
                note={`Only for the first ${PRICES.lifetimeLimit.toLocaleString('en')} founding members.`}
                cta="Get lifetime"
                onCta={openCheckout}
                tag="Founding"
                intro="Everything in Pro:"
                items={['All Pro features, forever', 'Every future update', 'Works on 2 computers', '14-day refund']}
              />
            </div>
          </>
        )}
        <div className={`${pro ? '' : 'mt-6'} grid gap-6 md:grid-cols-[1fr_1.3fr] md:items-start`}>
          <div className="text-sm text-muted">
            <p className="font-medium text-ink">{pro ? 'Thanks for supporting StepCrumb.' : 'Have a license key?'}</p>
            <p className="mt-1">{pro ? 'Your license, and the link to manage your subscription or computers, are here.' : 'Paste the license key from your purchase email to unlock Pro on this computer.'}</p>
          </div>
          <LicenseSection keyOnly />
        </div>
      </div>
    </div>
  )
}
