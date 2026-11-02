import { useState, type ReactNode } from 'react'
import { CONFIG } from '../config'
import { ChromeIcon, Logo } from './Top'

const USES: { title: string; body: string; tags: string[]; emoji: string }[] = [
  { emoji: '👋', title: 'Onboarding', body: 'Record how things are done once. Every new hire gets the same clear guide and video on day one.', tags: ['Guide', 'Video'] },
  { emoji: '🛠️', title: 'IT & support', body: 'Answer “how do I…?” with a link to a guide instead of another call. Passwords stay blurred.', tags: ['Guide', 'PDF'] },
  { emoji: '📋', title: 'Operations & SOPs', body: 'Turn the way your best people work into procedures with purpose, scope and revision history.', tags: ['SOP', 'Word'] },
  { emoji: '🎓', title: 'Customer training', body: 'Ship narrated walkthroughs of your product without booking a studio or a voice actor.', tags: ['Video', 'Voiceover'] },
  { emoji: '🔒', title: 'Regulated teams', body: 'Healthcare, finance, government: document systems without sending screens of them to anyone.', tags: ['Local only', 'SOP'] },
  { emoji: '🚀', title: 'System rollouts', body: 'Going live on a new CRM or ERP? Build the training pack while you configure it.', tags: ['Training', 'Quiz'] },
]

export function UseCases() {
  return (
    <section className="mx-auto max-w-[1240px] px-5 pb-24 sm:px-8 sm:pb-32">
      <div className="mx-auto mb-14 max-w-3xl text-center" data-reveal>
        <p className="eyebrow mb-4">Who it's for</p>
        <h2 className="display text-[40px] sm:text-[60px]">For anyone who explains things twice.</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {USES.map((u) => (
          <div key={u.title} className="group rounded-[24px] border border-line bg-white p-6 shadow-card transition-transform duration-300 hover:-translate-y-1" data-reveal>
            <span className="text-3xl" aria-hidden>
              {u.emoji}
            </span>
            <h3 className="mt-4 text-[19px] font-semibold">{u.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-soft">{u.body}</p>
            <div className="mt-4 flex gap-1.5">
              {u.tags.map((t) => (
                <span key={t} className="rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-soft ring-1 ring-line">
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

const PRIVACY = [
  ['Nothing uploaded', 'Screenshots, recordings, guides and voice all stay in your browser, on your computer.'],
  ['No account', 'Install and go. Paid features unlock with a license key, not a login.'],
  ['Secrets blurred', 'Passwords, card numbers and tokens are blurred in screenshots and every video frame.'],
  ['Works offline', 'After the one-time voice download, everything runs without an internet connection.'],
]

export function Privacy() {
  return (
    <section className="px-3 pb-24 sm:px-8 sm:pb-32">
      <div className="art art-ink mx-auto max-w-[1240px] rounded-[40px] px-6 py-20 text-white sm:px-14" data-reveal>
        <div className="max-w-2xl">
          <p className="eyebrow mb-4 text-white/60">Private by design</p>
          <h2 className="display text-[40px] sm:text-[60px]">Your screens stay yours.</h2>
          <p className="mt-5 text-[18px] leading-relaxed text-white/70">
            Most guide and video tools upload what's on your screen to their cloud. StepCrumb doesn't. It's built to work entirely on the computer you're using.
          </p>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-3xl bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {PRIVACY.map(([t, d]) => (
            <div key={t} className="bg-white/[0.04] p-6 backdrop-blur">
              <p className="text-[17px] font-semibold">{t}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-white/65">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

type Cell = true | false | string
const ROWS: [string, Cell, Cell, Cell][] = [
  ['Price', `Free, or $${CONFIG.founding.price} once`, '$35/mo ($25/mo yearly)', '$29/mo ($9/mo yearly)'],
  ['Step-by-step guides from your clicks', true, true, false],
  ['SOP & training documents', true, true, false],
  ['Export to Word, PDF, HTML, Markdown', true, true, false],
  ['Video with auto-zoom & smooth cursor', true, 'Share as video', true],
  ['Captions from your steps', true, false, 'Transcribed captions'],
  ['AI voiceover', 'Free, on your computer', false, 'Yes, sent to the cloud'],
  ['Passwords blurred automatically', true, 'Enterprise plan', false],
  ['Everything stays on your computer', true, false, 'Mostly'],
  ['Works on Windows', true, true, 'macOS only'],
]

function Mark({ v }: { v: Cell }) {
  if (v === true)
    return (
      <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-emerald-100 text-emerald-700" aria-label="Yes">
        ✓
      </span>
    )
  if (v === false)
    return (
      <span className="text-soft/60" aria-label="Not listed">
        —
      </span>
    )
  return <span className="text-[13px] text-soft">{v}</span>
}

export function Compare() {
  return (
    <section id="compare" className="mx-auto max-w-[1100px] px-5 pb-24 sm:px-8 sm:pb-32">
      <div className="mx-auto mb-12 max-w-3xl text-center" data-reveal>
        <p className="eyebrow mb-4">Compare</p>
        <h2 className="display text-[40px] sm:text-[60px]">Two tools in one. A fraction of the price.</h2>
        <p className="mt-5 text-[17px] text-soft">Guides like Scribe. Videos like Screen Studio. On your computer, for a one-time price.</p>
      </div>
      <div className="overflow-x-auto rounded-[28px] border border-line bg-white shadow-card" data-reveal>
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead>
            <tr className="border-b border-line">
              <th className="p-5 font-medium text-soft" />
              <th className="bg-indigo-50/70 p-5">
                <div className="flex items-center gap-2 font-semibold">
                  <Logo className="pointer-events-none scale-90" />
                </div>
              </th>
              <th className="p-5 font-semibold">Scribe Pro</th>
              <th className="p-5 font-semibold">Screen Studio</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([label, a, b, c], i) => (
              <tr key={label} className={i < ROWS.length - 1 ? 'border-b border-line/70' : ''}>
                <td className="p-5 font-medium">{label}</td>
                <td className="bg-indigo-50/70 p-5 font-semibold">
                  <Mark v={a} />
                </td>
                <td className="p-5">
                  <Mark v={b} />
                </td>
                <td className="p-5">
                  <Mark v={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-center text-[12px] text-soft">
        From scribe.com/pricing and screen.studio, checked November 2026. “—” means not listed on their site. Prices are per person.
      </p>
    </section>
  )
}

const FREE = ['Unlimited guides and screenshots', 'Auto-zoom screenshots with highlights', 'SOP and training templates', 'PDF export (with a small StepCrumb footer)', 'Video up to 2 minutes, 720p, watermark', 'Voiceover with 1 voice']
const PAID = ['Everything in Free, without limits', 'No branding on PDFs', 'Word, HTML and Markdown export', 'Video in 1080p, any length, no watermark', 'All 6 voices and all video backgrounds', 'Use on 2 computers']

function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 text-emerald-600" aria-hidden>
        ✓
      </span>
      <span>{children}</span>
    </li>
  )
}

export function Pricing() {
  const left = CONFIG.foundingSold === null ? null : Math.max(0, CONFIG.founding.limit - CONFIG.foundingSold)
  return (
    <section id="pricing" className="mx-auto max-w-[1240px] px-5 pb-24 sm:px-8 sm:pb-32">
      <div className="mx-auto mb-14 max-w-3xl text-center" data-reveal>
        <p className="eyebrow mb-4">Pricing</p>
        <h2 className="display text-[40px] sm:text-[60px]">Pay once. Keep it forever.</h2>
        <p className="mt-5 text-[17px] text-soft">The first {CONFIG.founding.limit.toLocaleString()} customers get lifetime access for a single payment.</p>
      </div>
      <div className="grid items-stretch gap-6 lg:grid-cols-3">
        <div className="flex flex-col rounded-[28px] border border-line bg-white p-8 shadow-card" data-reveal>
          <p className="text-[18px] font-semibold">Free</p>
          <p className="mt-1 text-[14px] text-soft">Everything you need to try it properly.</p>
          <p className="mt-6">
            <span className="display text-[56px]">$0</span>
          </p>
          <ul className="mt-6 flex-1 space-y-3 text-[15px]">
            {FREE.map((f) => (
              <Check key={f}>{f}</Check>
            ))}
          </ul>
          <a href={CONFIG.chromeStoreUrl} className="btn-ghost mt-8 w-full">
            <ChromeIcon /> Add to Chrome
          </a>
        </div>

        <div className="glow-border flex flex-col rounded-[28px] bg-white shadow-float lg:-my-4" data-reveal>
          <div className="relative z-10 flex h-full flex-col rounded-[26px] bg-white p-8">
            <div className="flex items-center justify-between">
              <p className="text-[18px] font-semibold">Founding {CONFIG.founding.limit.toLocaleString()}</p>
              <span className="rounded-full bg-ember/10 px-3 py-1 text-[12px] font-semibold text-ember">Lifetime</span>
            </div>
            <p className="mt-1 text-[14px] text-soft">One payment. Every paid feature, for good.</p>
            <p className="mt-6 flex items-end gap-2">
              <span className="display text-[56px]">${CONFIG.founding.price}</span>
              <span className="mb-3 text-[14px] text-soft">once</span>
            </p>
            {left !== null && (
              <div className="mt-2">
                <div className="h-2 overflow-hidden rounded-full bg-paper ring-1 ring-line">
                  <div className="h-full rounded-full bg-gradient-to-r from-ember to-pink-500" style={{ width: `${((CONFIG.founding.limit - left) / CONFIG.founding.limit) * 100}%` }} />
                </div>
                <p className="mt-1.5 text-[12px] font-semibold text-ember">{left.toLocaleString()} of {CONFIG.founding.limit.toLocaleString()} left</p>
              </div>
            )}
            <ul className="mt-6 flex-1 space-y-3 text-[15px]">
              {PAID.map((f) => (
                <Check key={f}>{f}</Check>
              ))}
            </ul>
            <a href={CONFIG.checkoutUrl} className="lemonsqueezy-button btn-dark mt-8 w-full">
              Get lifetime access
            </a>
            <p className="mt-3 text-center text-[12px] text-soft">Secure checkout by Lemon Squeezy. Your key arrives by email.</p>
          </div>
        </div>

        <div className="flex flex-col rounded-[28px] border border-line bg-white p-8 shadow-card" data-reveal>
          <p className="text-[18px] font-semibold">Pro</p>
          <p className="mt-1 text-[14px] text-soft">After the founding spots are gone.</p>
          <p className="mt-6 flex items-end gap-2">
            <span className="display text-[56px]">${CONFIG.pro.monthly}</span>
            <span className="mb-3 text-[14px] text-soft">/ month</span>
          </p>
          <p className="text-[13px] text-soft">or ${CONFIG.pro.yearly} / year</p>
          <ul className="mt-6 flex-1 space-y-3 text-[15px]">
            {PAID.map((f) => (
              <Check key={f}>{f}</Check>
            ))}
          </ul>
          <span className="btn mt-8 w-full cursor-default bg-paper text-soft ring-1 ring-line">Opens after the founding {CONFIG.founding.limit.toLocaleString()}</span>
        </div>
      </div>
    </section>
  )
}

const FAQS: [string, string][] = [
  ['Is everything really on my computer?', 'Yes. Screenshots, recordings, guides, documents and voiceovers are stored in your browser on your computer. StepCrumb only goes online to check a license key, and once to download the free voice model. If you choose to use the optional Claude writing feature with your own API key, that text goes to Anthropic only when you click it.'],
  ['Which browsers and computers does it work on?', 'Chrome and Microsoft Edge (and other Chromium browsers) on Windows, Mac, Linux and ChromeOS. It records one browser tab, so it works with anything you can open in a browser.'],
  ['Do I need an account?', 'No. The free plan needs nothing at all. When you buy, a license key arrives by email; paste it into Settings and the paid features unlock.'],
  ['What does “lifetime” mean?', `One payment of $${CONFIG.founding.price} unlocks every paid feature for as long as StepCrumb exists, including updates. Your key works on 2 computers (say, work and home). Getting a new computer? Email us and we'll move it.`],
  ['What happens after the first 1,000?', `Lifetime access closes and new customers pay $${CONFIG.pro.monthly}/month or $${CONFIG.pro.yearly}/year. Founding members keep lifetime access.`],
  ['What can I export?', 'Guides and documents export to PDF, Word, HTML and Markdown. Videos export as MP4 with captions and voiceover built in, plus subtitle files (SRT and VTT) for YouTube or your learning platform.'],
  ['Can it record desktop apps?', 'Not yet. StepCrumb records what happens in the browser. You can still add steps by hand and upload a screenshot for anything outside it.'],
  ['Can I get a refund?', `Yes. If StepCrumb isn't right for you, email ${CONFIG.contactEmail} within 14 days of buying for a full refund.`],
]

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="mx-auto max-w-[860px] px-5 pb-24 sm:px-8 sm:pb-32">
      <div className="mb-12 text-center" data-reveal>
        <p className="eyebrow mb-4">FAQ</p>
        <h2 className="display text-[40px] sm:text-[60px]">Questions, answered.</h2>
      </div>
      <div className="divide-y divide-line rounded-[28px] border border-line bg-white" data-reveal>
        {FAQS.map(([q, a], i) => (
          <div key={q}>
            <button className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left text-[17px] font-semibold" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              {q}
              <span className={`grid h-8 w-8 flex-none place-items-center rounded-full bg-paper text-[18px] transition-transform duration-300 ${open === i ? 'rotate-45' : ''}`} aria-hidden>
                +
              </span>
            </button>
            <div className={`grid transition-all duration-300 ${open === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <p className="overflow-hidden px-6 text-[15px] leading-relaxed text-soft">
                <span className="block pb-6">{a}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Founder() {
  return (
    <section className="mx-auto max-w-[860px] px-5 pb-24 sm:px-8 sm:pb-32" data-reveal>
      <div className="rounded-[28px] border border-line bg-white p-8 shadow-card sm:p-12">
        <p className="eyebrow mb-5">A note from the founder</p>
        <div className="space-y-4 text-[18px] leading-relaxed text-ink/85">
          <p>For years I used free screenshot tools, and I looked at guide tools that cost $35 a month per person. Every one of them wanted my screens in their cloud.</p>
          <p>
            I wanted one tool that makes the guide, the SOP and the video from a single click-through, and keeps all of it on my own computer. So I built StepCrumb. The first {CONFIG.founding.limit.toLocaleString()} people who join get it for life.
          </p>
        </div>
        <p className="mt-8 font-semibold">Sharuque</p>
        <p className="text-[14px] text-soft">Founder, StepCrumb</p>
      </div>
    </section>
  )
}

export function FinalCta() {
  return (
    <section className="px-3 pb-16 sm:px-8">
      <div className="art art-dusk mx-auto max-w-[1240px] rounded-[40px] px-6 py-24 text-center text-white sm:px-12" data-reveal>
        <h2 className="display mx-auto max-w-3xl text-[44px] sm:text-[72px]">Your next SOP is one click-through away.</h2>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <a href={CONFIG.chromeStoreUrl} className="btn bg-white px-7 py-3.5 text-[16px] text-ink hover:-translate-y-0.5 hover:shadow-float">
            <ChromeIcon /> Add to Chrome, it's free
          </a>
          <a href="#pricing" className="btn border border-white/80 px-7 py-3.5 text-[16px] text-white hover:bg-white hover:text-ink">
            Lifetime · ${CONFIG.founding.price}
          </a>
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-6 px-5 py-10 text-[14px] text-soft sm:px-8">
      <Logo />
      <span>© {new Date().getFullYear()} StepCrumb</span>
      <nav className="ml-auto flex flex-wrap gap-6">
        <a href="/privacy.html" className="hover:text-ink">
          Privacy
        </a>
        <a href="/terms.html" className="hover:text-ink">
          Terms
        </a>
        <a href={`mailto:${CONFIG.contactEmail}`} className="hover:text-ink">
          Contact
        </a>
      </nav>
    </footer>
  )
}
